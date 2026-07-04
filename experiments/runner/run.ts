// experiments/runner/run.ts
// Orchestrator. Reads prompts.jsonl, runs every prompt under both the
// vanilla and aether conditions, and writes:
//   experiments/results/raw_<runTag>.jsonl      — one row per (prompt, condition, iteration, attempt)
//   experiments/results/summary_<runTag>.csv    — one row per (prompt, condition, iteration)
//   experiments/results/runs_<runTag>/<id>_<cond>_<iter>.json  — full GenerationRun per (prompt, condition, iteration)
//
// Concurrency is bounded by a configurable cap (default 4). For the n=10 Qwen
// (Ollama) run the default is 10 iterations per (prompt, condition) so the
// total job count is 30 × 2 × 10 = 600. There is NO inter-attempt throttle:
// Ollama is local and has no rate limit, and the new ollama provider adapter
// fails fast on transport errors instead of backing off.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadManifest } from '../../src/manifest.js';
import type { AetherManifest } from '../../src/types.js';
import type { PromptRecord } from './vanilla.js';
import { runVanilla } from './vanilla.js';
import { runAether } from './aether.js';
import {
  appendCsv,
  buildRows,
  jobKey,
  JsonlWriter,
  loadExistingCsvKeys,
  loadExistingRawKeys,
  loadExistingRunKeys,
  summarizeRun,
} from './metrics.js';
import type { Condition, ExperimentRow, PromptSummary } from './metrics.js';

/**
 * Optional throttle between successful jobs. Defaults to 0 — Ollama has no
 * rate limits and the new ollama adapter fails fast on transport errors
 * rather than backing off. Set AETHER_INTER_ATTEMPT_DELAY_MS in the
 * environment to re-enable a pause (useful for paid APIs with their own
 * quota; never needed for the Qwen2.5-Coder n=10 batch).
 */
const INTER_ATTEMPT_DELAY_MS = Number(process.env.AETHER_INTER_ATTEMPT_DELAY_MS ?? 0) || 0;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface RunnerOptions {
  cwd: string;
  resultsDir: string;
  concurrency: number;
  provider?: string;
  model?: string;
  /** Subset of prompt ids to run (used for debugging and partial re-runs). */
  onlyPrompts?: string[];
  /** Subset of conditions (defaults to both). */
  conditions?: Condition[];
  /** Number of OUTER repetitions per (prompt, condition). Defaults to 10
   *  so the default batch is 30 × 2 × 10 = 600 jobs. Set to 1 for the
   *  legacy n=1 behaviour. */
  iterations?: number;
  /**
   * Suffix appended to all output filenames. Defaults to `qwen` so the
   * Qwen2.5-Coder n=10 run lands in summary_qwen.csv / raw_qwen.jsonl /
   * runs_qwen/ without colliding with the existing Gemini dataset.
   */
  runTag?: string;
}

interface Job {
  prompt: PromptRecord;
  condition: Condition;
  /** 1-indexed OUTER repetition number; the n=10 index. */
  iter: number;
  slot: number;
}

export async function runExperiments(opts: RunnerOptions): Promise<void> {
  const cwd = opts.cwd;
  const resultsDir = resolve(cwd, opts.resultsDir);
  mkdirSync(resultsDir, { recursive: true });
  const runTag = opts.runTag ?? 'qwen';
  const runsDir = resolve(resultsDir, `runs_${runTag}`);
  mkdirSync(runsDir, { recursive: true });

  // NOTE: We intentionally do NOT wipe the output files here. The resume
  // logic scans whatever is already on disk and skips completed
  // (prompt, condition, iteration) tuples. This makes the runner safe to
  // re-invoke after a Ctrl+C, an Ollama drop, or a transient provider
  // failure — the multi-key "relay race" pattern now generalised to n=10.
  // To start fresh, delete raw_<runTag>.jsonl + summary_<runTag>.csv +
  // runs_<runTag>/ before invoking.
  const rawPath = resolve(resultsDir, `raw_${runTag}.jsonl`);
  const csvPath = resolve(resultsDir, `summary_${runTag}.csv`);

  const loaded = await loadManifest(cwd);
  if (!loaded.ok) {
    throw new Error(`[runner] manifest load failed (${loaded.code}): ${loaded.error}`);
  }
  const manifest: AetherManifest = loaded.manifest;
  const prompts = loadPrompts(resolve(cwd, 'experiments/prompts/prompts.jsonl'));
  const filtered = opts.onlyPrompts
    ? prompts.filter(p => opts.onlyPrompts!.includes(p.id))
    : prompts;
  const conditions: Condition[] = opts.conditions ?? ['vanilla', 'aether'];
  const iterations: number = Math.max(1, opts.iterations ?? 10);

  // ── Resume detection ────────────────────────────────────────────────────
  // A (prompt, condition, iteration) tuple is considered "done" if ANY of
  // the three sources already records it: the JSONL, the CSV, or the
  // per-run JSON dump. We union the three sets so partial writes from a
  // prior crash still get recognized (e.g. JSONL written but per-run dump
  // truncated, or vice versa). The legacy n=1 shape (no iteration column)
  // is folded into iteration=1 by the loaders in metrics.ts so an old
  // single-run dataset isn't re-run on iter=1 of a fresh n=10 batch.
  const rawKeys = loadExistingRawKeys(rawPath);
  const csvKeys = loadExistingCsvKeys(csvPath);
  const runKeys = loadExistingRunKeys(runsDir);
  const completedKeys = new Set<string>([...rawKeys, ...csvKeys, ...runKeys]);

  const allJobs: Job[] = [];
  let slot = 0;
  for (const prompt of filtered) {
    for (const condition of conditions) {
      for (let iter = 1; iter <= iterations; iter++) {
        allJobs.push({ prompt, condition, iter, slot: slot % opts.concurrency });
        slot++;
      }
    }
  }
  const jobs = allJobs.filter(
    j => !completedKeys.has(jobKey(j.prompt.id, j.condition, j.iter))
  );

  const skipped = allJobs.length - jobs.length;
  console.error(
    `[runner] ${filtered.length} prompts × ${conditions.length} conditions × ${iterations} iterations = ${allJobs.length} total runs`
  );
  if (skipped > 0) {
    console.error(
      `[runner] resume: skipping ${skipped} already-completed run(s) found in raw_${runTag}.jsonl / summary_${runTag}.csv / runs_${runTag}/`
    );
  }
  if (jobs.length === 0) {
    console.error('[runner] nothing to do — all jobs already completed. Re-run analyze.ts to refresh tables.');
    return;
  }
  console.error(`[runner] remaining: ${jobs.length} runs (concurrency=${opts.concurrency}, provider=${opts.provider ?? 'default'}, model=${opts.model ?? 'default'})`);

  // JsonlWriter opens with flags: 'a' so we append, not truncate.
  const jsonl = new JsonlWriter(rawPath);
  const rows: ExperimentRow[] = [];
  const summaries: PromptSummary[] = [];

  // ── Simple worker pool ────────────────────────────────────────────────────
  let next = 0;
  let completed = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = next++;
      if (idx >= jobs.length) return;
      const job = jobs[idx];
      const { prompt, condition, iter, slot } = job;
      const tag = `${prompt.id}/${condition}/iter${iter}`;

      let run;
      try {
        run = condition === 'vanilla'
          ? await runVanilla(cwd, prompt, manifest, { provider: opts.provider, model: opts.model })
          : await runAether(cwd, prompt, manifest, { provider: opts.provider, model: opts.model });
      } catch (err: any) {
        // ── Strict error guard ────────────────────────────────────────────
        // Provider errors (transport drops, timeouts, 4xx/5xx) must NEVER
        // produce an empty/partial row in the output files. We log the
        // error, leave the on-disk state untouched, and let the user
        // re-invoke the runner. The skipped (prompt, condition, iter) tuple
        // will be picked up on the next start. For the Ollama path there
        // is no retry inside the adapter — this guard is the only retry
        // surface, and it relies on the user re-invoking the runner.
        const transient = isTransientError(err);
        const kind = transient ? 'RATE-LIMIT/TRANSIENT' : 'ERROR';
        console.error(`[runner] ${kind} on ${tag} — SKIPPED, no row written. Reason: ${formatError(err)}`);
        completed++;
        // No throttle even on transient errors: Ollama has no rate limit and
        // sleeping would just waste wall time on a dead remote.
        if (!transient && INTER_ATTEMPT_DELAY_MS > 0) await sleep(INTER_ATTEMPT_DELAY_MS);
        continue;
      }

      // From here on, the run is valid. Persist the per-run dump, then write
      // the rows. If the file write throws, the row still has not been
      // recorded in the JSONL/CSV — we re-throw and let the outer guard
      // handle it (which is impossible because we are past the catch, so
      // the only realistic failures here are disk-full / EROFS).
      try {
        const runFile = resolve(runsDir, `${prompt.id}_${condition}_${iter}.json`);
        writeFileSync(runFile, JSON.stringify(run, null, 2), 'utf8');

        const runRows = buildRows(prompt, condition, run, slot, iter);
        for (const r of runRows) {
          jsonl.write(r);
          rows.push(r);
        }
        summaries.push(summarizeRun(prompt, condition, run));
        console.error(`[runner] OK ${tag} (attempts=${run.attempts.length}, passed=${run.passed}, tokensIn=${run.attempts.reduce((n, a) => n + a.tokensIn, 0)}, tokensOut=${run.attempts.reduce((n, a) => n + a.tokensOut, 0)})`);
      } catch (err) {
        console.error(`[runner] post-run persistence failed for ${tag} (this should be a disk error):`, err);
        // Best-effort cleanup so the resume scan does not see a half-written
        // per-run JSON and mistakenly mark the job as done.
        try {
          const fs = await import('fs');
          fs.unlinkSync(resolve(runsDir, `${prompt.id}_${condition}_${iter}.json`));
        } catch { /* file may not have been written yet */ }
      }
      completed++;
      if (completed % 5 === 0 || completed === jobs.length) {
        console.error(`[runner] progress: ${completed}/${jobs.length}`);
      }
      // Throttle: pause before the next request. Defaults to 0 ms for the
      // Ollama pipeline (local, no rate limit). Set
      // AETHER_INTER_ATTEMPT_DELAY_MS to re-enable a paid-API throttle.
      if (INTER_ATTEMPT_DELAY_MS > 0) await sleep(INTER_ATTEMPT_DELAY_MS);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < opts.concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  await jsonl.close();

  // Append (not overwrite) so the rows written on prior runs are preserved.
  // If you actually want a clean slate, delete raw.jsonl + summary.csv +
  // runs/ before invoking the runner.
  appendCsv(csvPath, rows);
  console.error(`[runner] appended ${rows.length} new row(s) to ${csvPath}`);
  console.error(`[runner] appended to ${rawPath}`);
  console.error(`[runner] wrote ${summaries.length} per-run dumps to ${runsDir}`);
}

/**
 * Heuristic: an error is "transient" if the provider signalled a recoverable
 * status (429 quota, 503 overload) or if the message explicitly mentions a
 * rate limit / network blip. Used to decide whether the runner should skip
 * the throttle sleep and move on to the next job.
 */
function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = err?.status ?? err?.response?.status ?? err?.code;
  if (status === 429 || status === 503) return true;
  // Use a regex with word boundaries so substrings inside English words
  // (e.g. "rate" inside "generate", "rate") don't trigger a false positive.
  const msg = String(err?.message ?? err ?? '');
  return /\b(rate\s*limit|rate-limited|quota|resource_exhausted|unavailable|timeout|econnreset|etimedout|fetch failed|429|503)\b/i.test(msg);
}

function formatError(err: any): string {
  if (!err) return '(no error)';
  const status = err?.status ?? err?.response?.status;
  const code = err?.code;
  const msg = err?.message ?? String(err);
  const parts = [msg];
  if (status) parts.push(`status=${status}`);
  if (code) parts.push(`code=${code}`);
  return parts.join(' | ');
}

function loadPrompts(path: string): PromptRecord[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as PromptRecord);
}



// CLI: tsx experiments/runner/run.ts [--concurrency=4] [--only=P01,P07] [--conditions=vanilla,aether] [--provider=mock|gemini|ollama] [--model=qwen2.5-coder:7b-instruct-q4_K_M] [--iterations=10] [--tag=qwen]
const invokedDirectly = process.argv[1] && /[/\\]run\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  main({
    concurrency: Number(get('concurrency') ?? '4'),
    onlyPrompts: get('only')?.split(',').filter(Boolean),
    conditions: (get('conditions')?.split(',').filter(Boolean) as Condition[] | undefined),
    provider: get('provider'),
    model: get('model'),
    iterations: get('iterations') ? Number(get('iterations')) : undefined,
    runTag: get('tag'),
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

async function main(args: {
  concurrency: number;
  onlyPrompts?: string[];
  conditions?: Condition[];
  provider?: string;
  model?: string;
  iterations?: number;
  runTag?: string;
}): Promise<void> {
  await runExperiments({
    cwd: process.cwd(),
    resultsDir: 'experiments/results',
    concurrency: args.concurrency,
    onlyPrompts: args.onlyPrompts,
    conditions: args.conditions,
    provider: args.provider,
    model: args.model,
    iterations: args.iterations,
    runTag: args.runTag,
  });
}
