// experiments/runner/run_all_new_models.ts
// ─────────────────────────────────────────────────────────────────────────────
// Master orchestration script. Runs all three new Ollama models sequentially
// with a configurable cooldown between each model to allow the RTX 3050 GPU
// to cool down and Ollama to unload the previous model from VRAM before
// loading the next one.
//
// Usage:
//   npx tsx experiments/runner/run_all_new_models.ts
//
// Optional environment variables:
//   MODEL_COOLDOWN_MS   Inter-model cooldown in ms (default: 30000 = 30s)
//   SKIP_MODELS         Comma-separated labels to skip, e.g. "llama31_8b,gemma3_12b"
//
// Each model runner is fully resume-aware (checkpoint-based). If this script
// is killed mid-run and restarted, it will skip all completed evaluations
// across all models and continue from where it left off.
//
// Run order: llama3.1:8b → gemma3:12b → qwen2.5-coder:14b
// This order is intentional — lightest model first so any GPU warm-up cost is
// paid early, and both 12B/14B models run back-to-back when the GPU is already
// at steady-state temperature.
// ─────────────────────────────────────────────────────────────────────────────

import { runOllamaModel, type OllamaModelConfig } from './ollama-runner-core.js';

const COOLDOWN_MS = Number(process.env.MODEL_COOLDOWN_MS ?? 30_000);
const SKIP_LABELS = new Set(
  (process.env.SKIP_MODELS ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

const MODELS: OllamaModelConfig[] = [
  {
    model:            'llama3.1:8b-instruct-q4_K_M',
    endpoint:         'http://100.95.164.37:11434',
    outputFile:       'experiments/results/raw_llama31_8b.jsonl',
    label:            'llama31_8b',
    numCtx:           8192,
    maxTokens:        8192,
    interEvalDelayMs: 2_000,
    iterations:       10,
    timeoutMs:        300_000,
  },
  {
    model:            'gemma3:12b',
    endpoint:         'http://100.95.164.37:11434',
    outputFile:       'experiments/results/raw_gemma3_12b.jsonl',
    label:            'gemma3_12b',
    numCtx:           8192,
    maxTokens:        8192,
    interEvalDelayMs: 2_000,
    iterations:       10,
    timeoutMs:        420_000,
  },
  {
    model:            'qwen2.5-coder:14b-instruct-q4_K_M',
    endpoint:         'http://100.95.164.37:11434',
    outputFile:       'experiments/results/raw_qwen25_14b.jsonl',
    label:            'qwen25_14b',
    numCtx:           8192,
    maxTokens:        8192,
    interEvalDelayMs: 2_000,
    iterations:       10,
    timeoutMs:        420_000,
  },
];

async function main(): Promise<void> {
  const toRun = MODELS.filter(m => !SKIP_LABELS.has(m.label));
  const skipped = MODELS.length - toRun.length;

  console.log('╔' + '═'.repeat(70) + '╗');
  console.log('║  AETHER — Multi-Model Orchestrator'.padEnd(71) + '║');
  console.log('║  Models to run : ' + toRun.map(m => m.label).join(', ').padEnd(52) + '║');
  if (skipped > 0) {
    console.log('║  Skipped       : ' + [...SKIP_LABELS].join(', ').padEnd(52) + '║');
  }
  console.log('║  Cooldown      : ' + `${COOLDOWN_MS / 1000}s between models`.padEnd(52) + '║');
  console.log('╚' + '═'.repeat(70) + '╝\n');

  const globalStart = Date.now();
  const results: Array<{ label: string; status: 'ok' | 'error'; error?: string; durationMs: number }> = [];

  for (let i = 0; i < toRun.length; i++) {
    const config = toRun[i];
    const modelStart = Date.now();

    console.log(`\n${'▶'.repeat(3)} [${i + 1}/${toRun.length}] Starting model: ${config.model}\n`);

    try {
      await runOllamaModel(config);
      const durationMs = Date.now() - modelStart;
      results.push({ label: config.label, status: 'ok', durationMs });
      console.log(`\n✓ [${config.label}] Completed in ${(durationMs / 60_000).toFixed(1)} min\n`);
    } catch (err: any) {
      const durationMs = Date.now() - modelStart;
      const error = err?.message ?? String(err);
      results.push({ label: config.label, status: 'error', error, durationMs });
      console.error(`\n✗ [${config.label}] FAILED after ${(durationMs / 60_000).toFixed(1)} min: ${error}\n`);
      // Continue with remaining models even if one fails — partial data is
      // still valuable and can be re-run individually.
    }

    // Inter-model cooldown (skip after the last model)
    if (i < toRun.length - 1) {
      console.log(`\n⏸  Cooldown: waiting ${COOLDOWN_MS / 1000}s before next model…`);
      await sleep(COOLDOWN_MS);
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const totalMs = Date.now() - globalStart;
  console.log('\n' + '═'.repeat(72));
  console.log('  ORCHESTRATION COMPLETE');
  console.log(`  Total wall time: ${(totalMs / 60_000).toFixed(1)} min`);
  console.log('─'.repeat(72));
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : '✗';
    const dur  = (r.durationMs / 60_000).toFixed(1);
    const msg  = r.status === 'ok' ? `OK (${dur} min)` : `FAILED after ${dur} min — ${r.error}`;
    console.log(`  ${icon}  ${r.label.padEnd(18)} ${msg}`);
  }
  console.log('═'.repeat(72) + '\n');

  const anyFailed = results.some(r => r.status === 'error');
  if (anyFailed) process.exit(1);
}

main().catch(err => {
  console.error('[run_all_new_models] Unhandled fatal error:', err);
  process.exit(1);
});
