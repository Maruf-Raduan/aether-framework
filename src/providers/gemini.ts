// src/providers/gemini.ts
// Real Gemini adapter. BYOK via GEMINI_API_KEY or GOOGLE_API_KEY.
// Uses the official @google/genai SDK so we get streaming, retry, and
// structured output handling for free. This keeps the runtime portable
// (works under both bun and node + tsx).
//
// The adapter expects the model to return its answer in a fenced code block
// tagged with the `aether` language, e.g.:
//   ```aether:modules/tasks/routes/assign.ts
//   <source>
//   ```
// This is the convention extractFiles() understands (see providers/types.ts).
//
// Rate limiting note: the free tier caps requests at 15 RPM. The experiment
// runner inserts a 5-second pause between attempts in run.ts — this adapter
// does not pause on its own because the same throttle is desired across all
// providers (mock included) and is easier to enforce in the orchestrator.

import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';
import { extractFiles } from './types.js';

export interface GeminiProviderOptions {
  /** Default model id. Override with the AETHER_MODEL env var. */
  defaultModel?: string;
  /** Custom API key. Defaults to process.env.GEMINI_API_KEY || GOOGLE_API_KEY. */
  apiKey?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Hard cap on output tokens. */
  maxTokens?: number;
  /** Request timeout in ms; default 60s. */
  timeoutMs?: number;
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly defaultModel: string;
  private readonly apiKey: string | undefined;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly client: GoogleGenAI | undefined;

  constructor(opts: GeminiProviderOptions = {}) {
    this.defaultModel =
      opts.defaultModel ?? process.env.AETHER_MODEL ?? 'gemini-2.5-flash';
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    this.temperature = opts.temperature ?? 0;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey || !this.client) {
      throw new Error(
        'GeminiProvider: GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. ' +
        'Export it or pass apiKey in the constructor.',
      );
    }

    const model = req.model ?? this.defaultModel;
    const temperature = req.temperature ?? this.temperature;
    const maxTokens = req.maxTokens ?? this.maxTokens;

    const systemPrompt =
      'You are the Aether code generator. Produce only TypeScript source files. ' +
      'Wrap each file in a fenced code block tagged with the `aether` language ' +
      'and a path, e.g. ```aether:modules/tasks/routes/assign.ts. ' +
      'Respect all architectural constraints in the user message; never bypass them.';

    const t0 = performance.now();
    const timer = setTimeout(() => {
      // The SDK does not expose AbortSignal in the simple generateContent
      // path; instead we log a soft warning and let the request time out
      // on the SDK side. If the SDK ever gains signal support, wire it in.
    }, this.timeoutMs);

    let response;
    // Retry transient 429 (rate) / 503 (overload) up to 3 times with backoff.
    // The runner already spaces requests with INTER_ATTEMPT_DELAY_MS, so most
    // failures here are short-lived blips on Google's side, not true quotas.
    const transient = (e: any): boolean => {
      const s = e?.status ?? e?.response?.status;
      return s === 429 || s === 503;
    };
    let attempt = 0;
    try {
      for (;;) {
        try {
          response = await this.client.models.generateContent({
            model,
            contents: this.buildUserContent(req),
            config: {
              systemInstruction: systemPrompt,
              temperature,
              maxOutputTokens: maxTokens,
            },
          });
          break;
        } catch (e: any) {
          attempt++;
          if (attempt >= 3 || !transient(e)) throw e;
          const wait = 2000 * attempt; // 2s, 4s
          await new Promise<void>(r => setTimeout(r, wait));
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const body = response.text ?? '';
    const files = extractFiles(body);
    // The @google/genai SDK exposes usage under `response.usageMetadata` with
    // `promptTokenCount` (input) and `candidatesTokenCount` (output). Older
    // SDK revisions and certain error/empty responses omit the field or nest
    // it differently, so read defensively with optional chaining and coerce
    // anything non-numeric to 0. If extraction itself throws we fall back to
    // zeros — losing the token count is preferable to crashing the run.
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      const usage: any = response.usageMetadata;
      tokensIn = Number(usage?.promptTokenCount ?? 0) || 0;
      tokensOut = Number(usage?.candidatesTokenCount ?? 0) || 0;
    } catch {
      // usageMetadata threw on access (some SDK revisions do this on error
      // responses). Keep the zeros; the row still records latency + outcome.
    }

    return {
      files,
      tokensIn,
      tokensOut,
      latencyMs: Math.round(performance.now() - t0),
      model,
      stopReason: response.candidates?.[0]?.finishReason,
    };
  }

  private buildUserContent(req: LLMRequest): string {
    const parts: string[] = [req.promptText];
    if (req.attempt > 1 && req.errorHint) {
      parts.push(
        '\n\n── PREVIOUS ATTEMPT FAILED ─────────────────────\n' +
        'The previous attempt was rejected by the conformance judge. ' +
        'Fix every issue below on this attempt:\n' +
        req.errorHint,
      );
    }
    return parts.join('');
  }
}