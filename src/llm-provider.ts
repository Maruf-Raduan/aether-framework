// src/llm-provider.ts
// Backwards-compatible shim. The actual provider implementations live under
// src/providers/ and are selected by the AETHER_LLM env var (or by an explicit
// id passed to the experimental runner). This file is kept thin on purpose:
// every call site in the codebase continues to `import { generateCode } from
// './llm-provider.js'` and gets the same return shape it always has.

import type { LLMRequest, LLMResponse } from './providers/index.js';
import { getProvider, resetProviderCache } from './providers/index.js';
import type { VirtualFile } from './types.js';

/** @deprecated Kept for callers that read only the file list. Prefer LLMResponse. */
export interface LegacyLLMResponse {
  files: VirtualFile[];
}

/**
 * Generate a single completion for a target. This signature is preserved from
 * the original mock-only version so call sites in src/gen.ts keep compiling
 * unchanged.
 */
export async function generateCode(
  targetDesc: string,
  promptText: string,
  attempt: number,
  errorHint?: string,
  opts: { provider?: string; model?: string } = {}
): Promise<LLMResponse> {
  const provider = getProvider(opts.provider);
  const req: LLMRequest = {
    targetDesc,
    promptText,
    attempt,
    errorHint,
    model: opts.model,
  };
  return provider.generate(req);
}

/** Resets the cached provider so the next call re-reads env. Used by tests. */
export function resetProvider(): void {
  resetProviderCache();
}

// Re-export VirtualFile for callers that still grab it from this module.
export type { VirtualFile };
