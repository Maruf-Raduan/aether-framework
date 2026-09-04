// src/providers/index.ts
// Registry that resolves a provider by id or env. Used by gen.ts and by the
// experiment runner so the same code path picks up the real model on a
// contributor's machine and the deterministic mock during CI.

import type { LLMProvider } from './types.js';
import { MockLLMProvider } from './mock.js';
import { GeminiProvider } from './gemini.js';
import { OllamaProvider } from './ollama.js';

export type { LLMProvider, LLMRequest, LLMResponse } from './types.js';
export { extractFiles } from './types.js';
export { MockLLMProvider } from './mock.js';
export { GeminiProvider } from './gemini.js';
export { OllamaProvider } from './ollama.js';

let cached: LLMProvider | undefined;

/**
 * Returns a provider based on (in order):
 *   1. The AETHER_LLM env var (e.g. "mock" | "gemini" | "ollama")
 *   2. The presence of GEMINI_API_KEY / GOOGLE_API_KEY → GeminiProvider
 *   3. The presence of OLLAMA_ENDPOINT or AETHER_LLM=ollama → OllamaProvider
 *   4. The absence of all of the above → MockLLMProvider
 *
 * Pass an explicit id to bypass env detection (used by the experiment runner
 * so each condition is reproducible regardless of what the contributor has
 * configured locally).
 */
export function getProvider(id?: string): LLMProvider {
  if (cached) return cached;
  const resolved = resolveProvider(id);
  cached = resolved;
  return resolved;
}

export function resetProviderCache(): void {
  cached = undefined;
}

function resolveProvider(id?: string): LLMProvider {
  const env = id ?? process.env.AETHER_LLM;
  const hasGeminiKey =
    !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
  // ollama is the explicit opt-in: require either an explicit id ("ollama")
  // or AETHER_LLM=ollama. We do NOT auto-pick Ollama from OLLAMA_ENDPOINT
  // alone, because that env var is also useful for tooling that just wants
  // to point somewhere without flipping the default provider.
  if (env === 'ollama') {
    return new OllamaProvider();
  }
  if (env === 'gemini' || (!env && hasGeminiKey)) {
    return new GeminiProvider();
  }
  if (env === 'mock' || !env) {
    return new MockLLMProvider();
  }
  throw new Error(
    `Unknown LLM provider "${env}". Set AETHER_LLM to one of: mock, gemini, ollama.`
  );
}
