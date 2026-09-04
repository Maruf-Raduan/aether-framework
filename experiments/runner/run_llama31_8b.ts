// experiments/runner/run_llama31_8b.ts
// ─────────────────────────────────────────────────────────────────────────────
// Standalone evaluation runner for Llama 3.1 8B Instruct Q4_K_M via Ollama.
//
// Usage:
//   npx tsx experiments/runner/run_llama31_8b.ts
//
// Resume: safe to kill and restart at any time. The checkpoint file at
//   experiments/results/checkpoint_llama31_8b.json
// tracks completed (prompt_id, condition, iteration) tuples. Delete it to
// restart from zero.
//
// Output:
//   experiments/results/raw_llama31_8b.jsonl   — one JSONL row per evaluation
//   experiments/results/raw_llama31_8b.csv     — CSV mirror (appended)
//   experiments/results/runs_llama31_8b/       — per-run JSON dumps
//   experiments/results/checkpoint_llama31_8b.json
// ─────────────────────────────────────────────────────────────────────────────

import { runOllamaModel } from './ollama-runner-core.js';

runOllamaModel({
  model:            'llama3.1:8b-instruct-q4_K_M',
  endpoint:         'http://100.95.164.37:11434',
  outputFile:       'experiments/results/raw_llama31_8b.jsonl',
  label:            'llama31_8b',
  numCtx:           8192,
  maxTokens:        8192,
  interEvalDelayMs: 2_000,
  iterations:       10,
  timeoutMs:        300_000,
}).catch(err => {
  console.error('[run_llama31_8b] Fatal error:', err);
  process.exit(1);
});
