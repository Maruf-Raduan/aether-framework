// experiments/runner/run_qwen25_14b.ts
// ─────────────────────────────────────────────────────────────────────────────
// Standalone evaluation runner for Qwen 2.5 Coder 14B Instruct Q4_K_M via Ollama.
//
// Usage:
//   npx tsx experiments/runner/run_qwen25_14b.ts
//
// Resume: safe to kill and restart at any time. The checkpoint file at
//   experiments/results/checkpoint_qwen25_14b.json
// tracks completed (prompt_id, condition, iteration) tuples. Delete it to
// restart from zero.
//
// Note: This is the 14B parameter variant of the Qwen 2.5 Coder family,
// providing a direct within-family scale comparison to the 7B model evaluated
// in the primary study (raw_qwen.jsonl). The larger variant is expected to
// exhibit better context utilisation and potentially a different response to
// the Aether contract injection than the 7B baseline.
//
// Output:
//   experiments/results/raw_qwen25_14b.jsonl   — one JSONL row per evaluation
//   experiments/results/raw_qwen25_14b.csv     — CSV mirror (appended)
//   experiments/results/runs_qwen25_14b/       — per-run JSON dumps
//   experiments/results/checkpoint_qwen25_14b.json
// ─────────────────────────────────────────────────────────────────────────────

import { runOllamaModel } from './ollama-runner-core.js';

runOllamaModel({
  model:            'qwen2.5-coder:14b-instruct-q4_K_M',
  endpoint:         'http://100.95.164.37:11434',
  outputFile:       'experiments/results/raw_qwen25_14b.jsonl',
  label:            'qwen25_14b',
  numCtx:           8192,
  maxTokens:        8192,
  interEvalDelayMs: 2_000,
  iterations:       10,
  timeoutMs:        420_000,   // 7 min — 14B is larger, allow extra time
}).catch(err => {
  console.error('[run_qwen25_14b] Fatal error:', err);
  process.exit(1);
});
