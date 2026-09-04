// src/providers/ollama.ts
// Ollama HTTP adapter. Talks to a locally-hosted Ollama server via its
// /api/generate REST endpoint (no SDK needed). Used by the experiment runner
// when the user wants to evaluate open-weight models such as Qwen2.5-Coder.
//
// Contract (https://github.com/ollama/ollama/blob/main/docs/api.md):
//   POST {endpoint}/api/generate
//   body: { model, prompt, stream: false, options?: { temperature, num_predict, ... } }
//   resp: { model, response, prompt_eval_count, eval_count, total_duration, done, ... }
//
// We deliberately map:
//   prompt_eval_count → tokensIn   (input tokens, same as OpenAI/Anthropic convention)
//   eval_count        → tokensOut  (output tokens)
//
// Failure policy: NO RETRY. Ollama is local — if the server is unreachable or
// returns an error, we throw immediately so the runner can log the failure and
// move on. The previous 429/503 exponential backoff loop that the Gemini
// adapter carries is intentionally absent here.

import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';
import { extractFiles } from './types.js';

export interface OllamaProviderOptions {
  /** Ollama base URL. Defaults to the LAN address used for the Qwen run. */
  endpoint?: string;
  /** Default model id. Override via AETHER_MODEL or the constructor. */
  defaultModel?: string;
  /** Sampling temperature. Defaults to 0 (greedy) for reproducibility. */
  temperature?: number;
  /** Hard cap on output tokens. Ollama calls this num_predict. */
  maxTokens?: number;
  /**
   * Context window size in tokens. Ollama's default is model-specific (often
   * 2048–4096). Set this to 8192 or higher when running prompts that include
   * full Aether contracts + feature descriptions to prevent context overflow.
   * Maps directly to the `num_ctx` field in the Ollama options payload.
   */
  numCtx?: number;
  /** Request timeout in ms. Default 180s — local LLM inference can be slow
   *  on first-token (model load) and on long contexts. */
  timeoutMs?: number;
}

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly defaultModel: string;
  private readonly endpoint: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly numCtx: number | undefined;
  private readonly timeoutMs: number;

  constructor(opts: OllamaProviderOptions = {}) {
    // Endpoint precedence: explicit option > OLLAMA_ENDPOINT env > LAN default.
    // The LAN default matches the host used during the n=10 Qwen2.5-Coder run.
    this.endpoint = (
      opts.endpoint ??
      process.env.OLLAMA_ENDPOINT ??
      'http://100.99.187.110:11434'
    ).replace(/\/+$/, '');
    this.defaultModel =
      opts.defaultModel ?? process.env.AETHER_MODEL ?? 'qwen2.5-coder:7b-instruct-q4_K_M';
    this.temperature = opts.temperature ?? 0;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.numCtx = opts.numCtx;
    this.timeoutMs = opts.timeoutMs ?? 180_000;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const model = req.model ?? this.defaultModel;
    const temperature = req.temperature ?? this.temperature;
    const maxTokens = req.maxTokens ?? this.maxTokens;

    const payload: Record<string, unknown> = {
      model,
      prompt: req.promptText,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
        // num_ctx controls the KV-cache context window. When set, Ollama will
        // allocate exactly this many token slots, preventing truncation on
        // long Aether contract prompts. Omitted when not configured so we
        // don't override a model's native default unnecessarily.
        ...(this.numCtx !== undefined ? { num_ctx: this.numCtx } : {}),
      },
    };

    const url = `${this.endpoint}/api/generate`;
    const t0 = performance.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      // Network-level failure (ECONNREFUSED, ETIMEDOUT, DNS, etc.). Re-throw
      // with the original cause so the runner's isTransientError heuristic
      // can decide whether to skip — but we DO NOT retry here.
      const msg = err?.message ?? String(err);
      const wrapped: any = new Error(`OllamaProvider: fetch to ${url} failed: ${msg}`);
      wrapped.code = err?.code ?? err?.cause?.code;
      wrapped.cause = err;
      throw wrapped;
    }

    if (!res.ok) {
      // Non-2xx HTTP status. Try to parse the body so the log shows the
      // Ollama-side error message; re-throw with status attached so the
      // runner's isTransientError sees it.
      let bodyText = '';
      try { bodyText = await res.text(); } catch { /* body read failed */ }
      const wrapped: any = new Error(
        `OllamaProvider: ${url} returned ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`
      );
      wrapped.status = res.status;
      wrapped.response = { status: res.status, body: bodyText };
      throw wrapped;
    }

    let body: any;
    try {
      body = await res.json();
    } catch (err: any) {
      throw new Error(`OllamaProvider: failed to parse JSON from ${url}: ${err?.message ?? err}`);
    }

    // ── Token metrics ────────────────────────────────────────────────────
    // Ollama returns prompt_eval_count / eval_count as integers when the
    // server has counted the tokens; on very old builds or certain errors
    // these may be absent, in which case we record 0. Defensive coercion
    // (same pattern as the Gemini adapter) prevents NaN from corrupting the
    // CSV if Ollama ever returns a string instead of a number.
    const tokensIn = Number(body?.prompt_eval_count ?? 0) || 0;
    const tokensOut = Number(body?.eval_count ?? 0) || 0;

    const text: string = typeof body?.response === 'string' ? body.response : '';
    const files = extractFiles(text);

    return {
      files,
      tokensIn,
      tokensOut,
      latencyMs: Math.round(performance.now() - t0),
      model: typeof body?.model === 'string' ? body.model : model,
      // Ollama signals completion via `done: true`. `done_reason` is an
      // Ollama 0.5+ field; we surface it when present.
      stopReason: body?.done
        ? (typeof body?.done_reason === 'string' ? body.done_reason : 'end_turn')
        : 'unknown',
    };
  }
}
