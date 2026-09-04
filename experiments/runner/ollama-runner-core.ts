// experiments/runner/ollama-runner-core.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared evaluation engine used by the three new per-model runner scripts
// (run_llama31_8b.ts, run_gemma3_12b.ts, run_qwen25_14b.ts).
//
// Design rationale
// ─────────────────
// The existing run.ts / runExperiments() infrastructure injects the provider
// through the global singleton getProvider(). That cache means we cannot swap
// in a custom OllamaProvider (with num_ctx=8192) after the process starts
// without mutating shared state. Instead, this module bypasses getProvider()
// entirely and calls the OllamaProvider directly, mirrors the output schema of
// ExperimentRow exactly, and re-uses the JsonlWriter + appendCsv utilities from
// metrics.ts so the resulting JSONL files are byte-compatible with the existing
// Qwen dataset and can be merged by analyze_master.py without modification.
//
// Checkpoint format
// ─────────────────
// experiments/results/checkpoint_<safeModelName>.json
// { "done": ["P01|vanilla|1", "P01|vanilla|2", ...] }
// Loaded on startup, updated after every successful evaluation, checked before
// every job to skip already-completed work. Safe to delete to restart from zero.
//
// Exit behaviour
// ──────────────
// Ctrl+C / SIGTERM: the in-flight fetch will complete (or timeout at 300s), the
// row is written, the checkpoint is updated, and the process exits cleanly.
// On the next start, that row is detected via the checkpoint and skipped.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadManifest } from '../../src/manifest.js';
import type { AetherManifest } from '../../src/types.js';
import { OllamaProvider } from '../../src/providers/ollama.js';
import { runContractSuite } from '../../src/suites/c-suite.js';
import { runGenerationSuite } from '../../src/suites/g-suite.js';
import type { VirtualFile } from '../../src/types.js';
import type { PromptRecord } from './vanilla.js';
import { buildAetherPrompt } from './aether.js';
import { VANILLA_PREAMBLE } from './vanilla.js';
import {
  appendCsv,
  JsonlWriter,
  jobKey,
  type ExperimentRow,
  type Condition,
} from './metrics.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OllamaModelConfig {
  /** Ollama model tag, e.g. "llama3.1:8b-instruct-q4_K_M". */
  model: string;
  /** Ollama API base URL. */
  endpoint: string;
  /** JSONL output path relative to cwd, e.g. "experiments/results/raw_llama31_8b.jsonl". */
  outputFile: string;
  /** Concise label used in console output and checkpoint filename, e.g. "llama31_8b". */
  label: string;
  /** Context window size (tokens). Defaults to 8192. */
  numCtx?: number;
  /** Delay in ms between evaluations. Defaults to 2000. */
  interEvalDelayMs?: number;
  /** Iterations per (prompt, condition). Defaults to 10. */
  iterations?: number;
  /** Max output tokens. Defaults to 8192 (matches numCtx so output is never capped). */
  maxTokens?: number;
  /** Timeout per request in ms. Defaults to 300_000 (5 min). */
  timeoutMs?: number;
}

// ─── Checkpoint helpers ───────────────────────────────────────────────────────

function checkpointPath(resultsDir: string, label: string): string {
  return resolve(resultsDir, `checkpoint_${label}.json`);
}

function loadCheckpoint(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { done?: string[] };
    return new Set(raw.done ?? []);
  } catch {
    console.error(`[core] Warning: could not parse checkpoint at ${path}, starting fresh.`);
    return new Set();
  }
}

function saveCheckpoint(path: string, done: Set<string>): void {
  writeFileSync(path, JSON.stringify({ done: [...done] }, null, 2), 'utf8');
}

// ─── Prompt loading ───────────────────────────────────────────────────────────

function loadPrompts(promptsPath: string): PromptRecord[] {
  return readFileSync(promptsPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as PromptRecord);
}

// ─── Row builder ──────────────────────────────────────────────────────────────
// Mirrors buildRows() from metrics.ts but works with the inline attempt data
// produced by this core (we don't go through GenerationRun).

function buildRow(
  prompt: PromptRecord,
  condition: Condition,
  iteration: number,
  attempt: number,
  finalPassed: boolean,
  rules: {
    g1_db_driver: number;
    g2_auth_missing: number;
    g3_cross_module: number;
    g5_ts_errors: number;
    g_other_failures: number;
    rules_total: number;
    rules_passed: number;
    rules_failed: number;
    rules_skipped: number;
  },
  tokens: { tokens_in: number; tokens_out: number; tokens_total: number },
  timing: { latency_ms: number; wall_ms: number },
  provider: string,
  model: string,
): ExperimentRow {
  return {
    prompt_id: prompt.id,
    domain: prompt.domain,
    route: prompt.route,
    complexity: prompt.complexity,
    condition,
    iteration,
    attempt,
    passed: finalPassed,
    final_passed: finalPassed,
    rules_total: rules.rules_total,
    rules_passed: rules.rules_passed,
    rules_failed: rules.rules_failed,
    rules_skipped: rules.rules_skipped,
    g1_db_driver: rules.g1_db_driver,
    g2_auth_missing: rules.g2_auth_missing,
    g3_cross_module: rules.g3_cross_module,
    g5_ts_errors: rules.g5_ts_errors,
    g_other_failures: rules.g_other_failures,
    tokens_in: tokens.tokens_in,
    tokens_out: tokens.tokens_out,
    tokens_total: tokens.tokens_total,
    latency_ms: timing.latency_ms,
    wall_ms: timing.wall_ms,
    provider,
    model,
    concurrency_slot: 0, // always sequential — single slot
  };
}

// ─── Rule extraction ──────────────────────────────────────────────────────────

function extractRuleMetrics(gResult: ReturnType<typeof runGenerationSuite>) {
  const byId = Object.fromEntries(gResult.results.map(r => [r.id, r]));
  const g1 = byId['g1'];
  const g2 = byId['g2'];
  const g3 = byId['g3'];
  const g5 = byId['g5'];

  let rules_passed = 0, rules_failed = 0, rules_skipped = 0;
  for (const r of gResult.results) {
    if (r.skipped) rules_skipped++;
    else if (r.passed) rules_passed++;
    else rules_failed++;
  }

  return {
    rules_total: gResult.results.length,
    rules_passed,
    rules_failed,
    rules_skipped,
    g1_db_driver:     g1 && !g1.passed && !g1.skipped ? 1 : 0,
    g2_auth_missing:  g2 && !g2.passed && !g2.skipped ? 1 : 0,
    g3_cross_module:  g3 && !g3.passed && !g3.skipped ? 1 : 0,
    g5_ts_errors:     g5 && !g5.passed && !g5.skipped ? 1 : 0,
    g_other_failures: Math.max(
      0,
      rules_failed
        - (g1 && !g1.passed && !g1.skipped ? 1 : 0)
        - (g2 && !g2.passed && !g2.skipped ? 1 : 0)
        - (g3 && !g3.passed && !g3.skipped ? 1 : 0)
        - (g5 && !g5.passed && !g5.skipped ? 1 : 0),
    ),
  };
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runOllamaModel(config: OllamaModelConfig): Promise<void> {
  const cwd = process.cwd();
  const numCtx         = config.numCtx          ?? 8192;
  const maxTokens      = config.maxTokens        ?? 8192;
  const interDelay     = config.interEvalDelayMs ?? 2_000;
  const iterations     = config.iterations       ?? 10;
  const timeoutMs      = config.timeoutMs        ?? 300_000;

  // ── Directory setup ────────────────────────────────────────────────────────
  const resultsDir = resolve(cwd, 'experiments/results');
  const runsDir    = resolve(resultsDir, `runs_${config.label}`);
  mkdirSync(resultsDir, { recursive: true });
  mkdirSync(runsDir,    { recursive: true });

  const rawPath  = resolve(cwd, config.outputFile);
  const csvPath  = rawPath.replace(/\.jsonl$/, '.csv');
  const ckptPath = checkpointPath(resultsDir, config.label);

  // ── Load manifest & prompts ───────────────────────────────────────────────
  const loaded = await loadManifest(cwd);
  if (!loaded.ok) {
    throw new Error(`[${config.label}] manifest load failed (${loaded.code}): ${loaded.error}`);
  }
  const manifest: AetherManifest = loaded.manifest;
  const prompts = loadPrompts(resolve(cwd, 'experiments/prompts/prompts.jsonl'));

  // ── Resume: load existing checkpoint ──────────────────────────────────────
  const done = loadCheckpoint(ckptPath);

  // ── Build job list ────────────────────────────────────────────────────────
  type Job = { prompt: PromptRecord; condition: Condition; iter: number };
  const allJobs: Job[] = [];
  for (const prompt of prompts) {
    for (const condition of ['vanilla', 'aether'] as Condition[]) {
      for (let iter = 1; iter <= iterations; iter++) {
        allJobs.push({ prompt, condition, iter });
      }
    }
  }
  const pending = allJobs.filter(j => !done.has(jobKey(j.prompt.id, j.condition, j.iter)));

  console.log(
    `\n${'═'.repeat(72)}\n` +
    `  Model  : ${config.model}\n` +
    `  Label  : ${config.label}\n` +
    `  Output : ${config.outputFile}\n` +
    `  num_ctx: ${numCtx}\n` +
    `  Total jobs : ${allJobs.length}  |  Already done: ${done.size}  |  Remaining: ${pending.length}\n` +
    `${'═'.repeat(72)}\n`
  );

  if (pending.length === 0) {
    console.log(`[${config.label}] All jobs already completed. Nothing to do.`);
    return;
  }

  // ── Provider ──────────────────────────────────────────────────────────────
  const provider = new OllamaProvider({
    endpoint:     config.endpoint,
    defaultModel: config.model,
    numCtx,
    maxTokens,
    temperature:  0,
    timeoutMs,
  });

  // ── JSONL writer (append mode) ────────────────────────────────────────────
  const jsonl = new JsonlWriter(rawPath);
  const csvRows: ExperimentRow[] = [];

  // ── Sequential evaluation loop ────────────────────────────────────────────
  for (let idx = 0; idx < pending.length; idx++) {
    const { prompt, condition, iter } = pending[idx];
    const tag = `[${config.label}] [${prompt.id}] [${condition}] [iter ${iter}/${iterations}]`;

    // Build prompt text
    const promptText = condition === 'vanilla'
      ? `${VANILLA_PREAMBLE}\n\nFEATURE: ${prompt.description}\n`
      : buildAetherPrompt(cwd, manifest, prompt);

    const wallStart = performance.now();
    let tokensIn = 0, tokensOut = 0, latencyMs = 0;
    let files: VirtualFile[] = [];
    let apiError: string | null = null;

    // ── LLM call ────────────────────────────────────────────────────────────
    try {
      const resp = await provider.generate({
        targetDesc: prompt.description,
        promptText,
        attempt: 1,
        model: config.model,
      });
      tokensIn   = resp.tokensIn;
      tokensOut  = resp.tokensOut;
      latencyMs  = resp.latencyMs;
      files      = resp.files;
    } catch (err: any) {
      apiError = err?.message ?? String(err);
      console.error(`${tag} — API ERROR: ${apiError}. Row NOT written, will retry on next run.`);
      // Do not write any row or checkpoint — the job remains pending.
      // Respect inter-eval delay so we don't hammer a recovering server.
      if (idx < pending.length - 1) await sleep(interDelay);
      continue;
    }

    const wallMs = Math.round(performance.now() - wallStart);

    // ── G-Suite evaluation ───────────────────────────────────────────────────
    const gResult = runGenerationSuite(cwd, manifest, undefined, files);
    const rules   = extractRuleMetrics(gResult);
    const passed  = rules.rules_failed === 0;
    const tokensTotal = tokensIn + tokensOut;

    // ── Console progress log ─────────────────────────────────────────────────
    console.log(
      `${tag} — tokens_out: ${tokensOut}, latency: ${latencyMs}ms, ` +
      `passed: ${passed} [${idx + 1}/${pending.length}]`
    );

    // ── Persist per-run JSON dump ────────────────────────────────────────────
    const runFile = resolve(runsDir, `${prompt.id}_${condition}_${iter}.json`);
    writeFileSync(runFile, JSON.stringify({
      promptId: prompt.id,
      condition,
      iteration: iter,
      passed,
      tokensIn,
      tokensOut,
      tokensTotal,
      latencyMs,
      wallMs,
      files: files.map(f => ({ path: f.path, length: f.content.length })),
      rules: gResult.results.map(r => ({ id: r.id, passed: r.passed, skipped: !!r.skipped, message: r.message })),
    }, null, 2), 'utf8');

    // ── Build and write JSONL row ────────────────────────────────────────────
    const row = buildRow(
      prompt, condition, iter,
      /*attempt*/ 1,
      passed,
      rules,
      { tokens_in: tokensIn, tokens_out: tokensOut, tokens_total: tokensTotal },
      { latency_ms: latencyMs, wall_ms: wallMs },
      'ollama',
      config.model,
    );
    jsonl.write(row);
    csvRows.push(row);

    // ── Update checkpoint ────────────────────────────────────────────────────
    done.add(jobKey(prompt.id, condition, iter));
    saveCheckpoint(ckptPath, done);

    // ── Inter-evaluation delay ───────────────────────────────────────────────
    if (idx < pending.length - 1) await sleep(interDelay);
  }

  // ── Finalise output files ─────────────────────────────────────────────────
  await jsonl.close();
  appendCsv(csvPath, csvRows);

  const total = done.size;
  console.log(
    `\n${'═'.repeat(72)}\n` +
    `  [${config.label}] COMPLETE\n` +
    `  Wrote ${csvRows.length} new rows → ${rawPath}\n` +
    `  Total checkpoint entries: ${total}\n` +
    `${'═'.repeat(72)}\n`
  );
}
