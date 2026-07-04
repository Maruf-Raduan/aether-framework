// experiments/runner/run_gemma3_12b.ts
// ─────────────────────────────────────────────────────────────────────────────
// Standalone evaluation runner for Gemma 3 12B via Ollama.
//
// Usage:
//   npx tsx experiments/runner/run_gemma3_12b.ts
//
// Resume: safe to kill and restart at any time. The checkpoint file at
//   experiments/results/checkpoint_gemma3_12b.json
// tracks completed (prompt_id, condition, iteration) tuples. Delete it to
// restart from zero.
//
// Note on timeoutMs: Gemma 3 12B is a significantly larger model than the 7B
// Qwen baseline. On an RTX 3050 8 GB with Q4_K_M quantization, the first-token
// latency can exceed 2–3 minutes on long Aether prompts. The 420s timeout here
// gives a comfortable margin; reduce to 300s if the model consistently finishes
// faster after warmup.
//
// Output:
//   experiments/results/raw_gemma3_12b.jsonl   — one JSONL row per evaluation
//   experiments/results/raw_gemma3_12b.csv     — CSV mirror (appended)
//   experiments/results/runs_gemma3_12b/       — per-run JSON dumps
//   experiments/results/checkpoint_gemma3_12b.json
// ─────────────────────────────────────────────────────────────────────────────

import { runOllamaModel } from './ollama-runner-core.js';

runOllamaModel({
  model:            'gemma3:12b',
  endpoint:         'http://100.95.164.37:11434',
  outputFile:       'experiments/results/raw_gemma3_12b.jsonl',
  label:            'gemma3_12b',
  numCtx:           8192,
  maxTokens:        8192,
  interEvalDelayMs: 2_000,
  iterations:       10,
  timeoutMs:        420_000,   // 7 min — larger model, give extra headroom
}).catch(err => {
  console.error('[run_gemma3_12b] Fatal error:', err);
  process.exit(1);
});
