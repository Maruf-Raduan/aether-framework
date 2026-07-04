// src/providers/types.ts
// Provider-agnostic LLM contract used by the generation loop and the experiment
// harness. Every adapter (mock, Anthropic, OpenAI) implements this interface so
// the rest of the system does not need to know which model is in use.

import type { VirtualFile } from '../types.js';

/** A single response from the LLM. Adapters must always return valid TS source. */
export interface LLMResponse {
  files: VirtualFile[];
  /** Tokens billed for the prompt (input side). */
  tokensIn: number;
  /** Tokens billed for the completion (output side). */
  tokensOut: number;
  /** Wall-clock time the adapter spent producing this response, in ms. */
  latencyMs: number;
  /** Raw model identifier for audit purposes, e.g. "claude-sonnet-4-5". */
  model: string;
  /** Stop reason, e.g. "end_turn" | "max_tokens" | "tool_use" | "stop_sequence". */
  stopReason?: string;
}

/** The input to a provider call. Mirrors what gen.ts already passes. */
export interface LLMRequest {
  /** Natural-language description of the feature to generate. */
  targetDesc: string;
  /** Fully assembled prompt (manifest + contracts + ai-context). For vanilla runs this is the vanilla preamble + description. */
  promptText: string;
  /** 1-indexed attempt number. Adapters may use this to vary behaviour (mock scenario 2 depends on it). */
  attempt: number;
  /** Optional human-readable error string from the previous failed attempt. */
  errorHint?: string;
  /** Optional override of the model identifier; falls back to provider default. */
  model?: string;
  /** Sampling temperature. Defaults to 0 when omitted. */
  temperature?: number;
  /** Hard cap on output tokens. */
  maxTokens?: number;
}

/** The contract every provider must implement. */
export interface LLMProvider {
  /** Stable identifier for logs and result rows, e.g. "mock", "anthropic", "openai". */
  readonly id: string;
  /** The default model identifier used when request.model is absent. */
  readonly defaultModel: string;
  /** Produce one completion. Must throw on transport errors so the caller can retry. */
  generate(req: LLMRequest): Promise<LLMResponse>;
}

// ─── Extraction helper ────────────────────────────────────────────────────────
// Many models return source files wrapped in code fences. This helper extracts
// the files from a markdown-style response, regardless of which provider the
// model came from. The vanilla baseline and the Aether harness both rely on
// it so the comparison is fair: the only difference is the prompt, not the
// post-processing.

/** A single file block extracted from a model response. */
export interface ExtractedFile {
  path: string;
  content: string;
}

/**
 * Parses a model response body into a list of files.
 * Accepts two formats:
 *
 *   1. ```aether:path/to/file.ts\n<code>\n```
 *   2. ```ts\n// aether:path/to/file.ts\n<code>\n```
 *
 * If the response does not follow either convention, the entire body is
 * returned as a single file at `unnamed.ts` so the conformance check can
 * still evaluate it.
 */
export function extractFiles(body: string): VirtualFile[] {
  const files: VirtualFile[] = [];
  const fenced = [...body.matchAll(/```([a-zA-Z0-9_]*)\n([\s\S]*?)```/g)];

  for (const [, langRaw, block] of fenced) {
    // Strategy 1: aether:<path> on the first non-blank line of the block
    const aetherMatch = block.match(/^\s*(?:\/\/|\#|\s)*aether:\s*(\S+)\s*\n([\s\S]*)$/m);
    if (aetherMatch) {
      files.push({ path: aetherMatch[1].trim(), content: aetherMatch[2].trimEnd() });
      continue;
    }

    // Strategy 2: the path appears in a leading comment of the code block
    const pathComment = block.match(/^\s*(?:\/\/|\#)\s*(?:path|file):\s*(\S+)\s*\n([\s\S]*)$/i);
    if (pathComment) {
      files.push({ path: pathComment[1].trim(), content: pathComment[2].trimEnd() });
      continue;
    }

    // Strategy 3: fall back to a language-tagged block with a default name
    const lang = langRaw.toLowerCase();
    if (lang === 'ts' || lang === 'typescript' || lang === 'tsx' || lang === 'js' || lang === 'javascript') {
      files.push({ path: `unnamed.${lang === 'tsx' ? 'tsx' : 'ts'}`, content: block.trimEnd() });
    }
  }

  if (files.length === 0) {
    // The model wrote plain text with no fences — treat the whole body as one
    // file so we can still measure whether it would have compiled.
    files.push({ path: 'unnamed.ts', content: body.trim() });
  }

  return files;
}
