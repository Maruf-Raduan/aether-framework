// experiments/runner/metrics.ts
// One row per (prompt, condition, attempt). The same shape goes to:
//   - results/raw.jsonl     (machine-readable, full detail)
//   - results/summary.csv   (one row per prompt, easy to open in Excel)
//
// We intentionally keep the schema flat and explicit — every analysis script
// reads from these files and we want them to be queryable with grep + awk
// when reviewers want to spot-check the data.

import { appendFileSync, createWriteStream, existsSync, readFileSync, readdirSync, WriteStream, writeFileSync } from 'fs';
import type { GenerationRun } from '../../src/gen-headless.js';
import type { PromptRecord } from './vanilla.js';

/**
 * Stable "prompt|condition|iter" identifier used for resume tracking.
 *
 * For the n=10 scaled runs (Qwen via Ollama, etc.) the iter dimension is
 * part of the key so a crash mid-batch resumes at the exact missing
 * iteration rather than re-running a (prompt, condition) that is partially
 * complete. Callers that don't care about iteration (the existing
 * loadExistingRawKeys / loadExistingCsvKeys scan over legacy data) can
 * pass iter=1 and rely on the outer dimension to disambiguate.
 */
export function jobKey(promptId: string, condition: Condition, iter: number = 1): string {
  return `${promptId}|${condition}|${iter}`;
}

/**
 * Read raw.jsonl (if it exists) and return the set of (prompt_id, condition,
 * iteration) keys that already have at least one valid attempt row on disk.
 *
 * Robust to:
 *   - missing file             → returns an empty set
 *   - header-only / empty file → returns an empty set
 *   - partial / corrupt rows   → the offending line is skipped (logged)
 *   - legacy rows missing the iteration field → assumed iteration=1
 *
 * A "valid" row must parse as JSON and have a non-empty prompt_id + condition.
 */
export function loadExistingRawKeys(rawPath: string): Set<string> {
  const keys = new Set<string>();
  if (!existsSync(rawPath)) return keys;
  const text = readFileSync(rawPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Partial<ExperimentRow>;
      if (row.prompt_id && row.condition) {
        // Defensive: legacy rows don't have iteration. Default to 1 so a
        // fresh n=10 batch treats a pre-existing n=1 run as iter=1.
        const iter = Number(row.iteration ?? 1) || 1;
        keys.add(jobKey(row.prompt_id, row.condition as Condition, iter));
      }
    } catch {
      // Tolerate a half-written trailing line from a prior crashed run.
    }
  }
  return keys;
}

/**
 * Read summary.csv (if it exists) and return the same key set. CSV and JSONL
 * stay in sync under normal operation; both are scanned so resume works even
 * if one of the files was hand-edited or partially written.
 *
 * Accepts the legacy header (no iteration column) and the n=10 header (with
 * iteration column). Legacy rows default to iteration=1.
 */
export function loadExistingCsvKeys(csvPath: string): Set<string> {
  const keys = new Set<string>();
  if (!existsSync(csvPath)) return keys;
  const lines = readFileSync(csvPath, 'utf8').split('\n');
  if (lines.length < 2) return keys; // header only (or empty)
  const header = lines[0].split(',');
  const idIdx = header.indexOf('prompt_id');
  const condIdx = header.indexOf('condition');
  const iterIdx = header.indexOf('iteration');
  if (idIdx < 0 || condIdx < 0) return keys;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const id = cells[idIdx];
    const cond = cells[condIdx];
    if (!id || !cond) continue;
    const iter = iterIdx >= 0 ? (Number(cells[iterIdx]) || 1) : 1;
    keys.add(jobKey(id, cond as Condition, iter));
  }
  return keys;
}

/**
 * Scan runs/ for `<id>_<condition>[_<iter>].json` files and return their keys.
 *
 * Accepts BOTH the legacy `<id>_<condition>.json` shape (single iteration,
 * n=1 era) AND the n=10 shape `<id>_<condition>_<iter>.json`. Legacy files
 * are mapped to iter=1 so they don't get re-run on the first iteration of
 * a fresh n=10 batch.
 */
export function loadExistingRunKeys(runsDir: string): Set<string> {
  const keys = new Set<string>();
  if (!existsSync(runsDir)) return keys;
  for (const name of readdirSync(runsDir)) {
    // n=10 shape (preferred): P01_vanilla_3.json
    const m10 = name.match(/^(.+?)_(vanilla|aether)_(\d+)\.json$/);
    if (m10) {
      keys.add(jobKey(m10[1], m10[2] as Condition, Number(m10[3])));
      continue;
    }
    // Legacy n=1 shape: P01_vanilla.json  → assumed iter=1
    const m1 = name.match(/^(.+?)_(vanilla|aether)\.json$/);
    if (m1) keys.add(jobKey(m1[1], m1[2] as Condition, 1));
  }
  return keys;
}

export type Condition = 'vanilla' | 'aether';

export interface ExperimentRow {
  prompt_id: string;
  domain: string;
  route: string;
  complexity: 'low' | 'medium' | 'high';
  condition: Condition;
  /**
   * OUTER repetition number (1..n). For the n=10 Qwen run this is the
   * independent re-run index, distinct from `attempt` which is the inner
   * self-healing attempt within a single run. Always 1 for legacy n=1 data.
   */
  iteration: number;
  attempt: number;
  passed: boolean;
  /** Final outcome for the run (true iff this or any later attempt passed). */
  final_passed: boolean;
  /** Total G-suite rules considered. */
  rules_total: number;
  /** Number of G-suite rules that passed. */
  rules_passed: number;
  /** Number of G-suite rules that failed. */
  rules_failed: number;
  /** Number of G-suite rules skipped. */
  rules_skipped: number;
  /** 1 if G1 (DB driver import) failed on this attempt, else 0. */
  g1_db_driver: number;
  /** 1 if G2 (missing requireUser) failed on this attempt, else 0. */
  g2_auth_missing: number;
  /** 1 if G3 (cross-module import) failed on this attempt, else 0. */
  g3_cross_module: number;
  /** 1 if G5 (TypeScript diagnostics) failed on this attempt, else 0. */
  g5_ts_errors: number;
  /** Any other G-suite failure not covered above. */
  g_other_failures: number;
  /** Tokens billed for the input prompt on this attempt. */
  tokens_in: number;
  /** Tokens billed for the model output on this attempt. */
  tokens_out: number;
  /** Total tokens consumed so far (cumulative across attempts in the run). */
  tokens_total: number;
  /** Wall time for this single attempt in ms. */
  latency_ms: number;
  /** Cumulative wall time for the run so far in ms. */
  wall_ms: number;
  /** Provider id (e.g. "mock", "anthropic"). */
  provider: string;
  /** Model identifier (e.g. "claude-sonnet-4-5"). */
  model: string;
  /** Concurrency slot used by the orchestrator (0..max-1). */
  concurrency_slot: number;
}

/**
 * Build a flat list of rows for every attempt in a single run.
 *
 * `iteration` is the OUTER repetition number (1..n). The runner passes it
 * through so each n=10 repetition produces a distinct row with its own
 * iteration tag — crucial for downstream CI bars and bootstrap CIs.
 */
export function buildRows(
  prompt: PromptRecord,
  condition: Condition,
  run: GenerationRun,
  concurrencySlot: number,
  iteration: number = 1
): ExperimentRow[] {
  let tokensTotal = 0;
  return run.attempts.map((a) => {
    const g1 = a.rules['g1'];
    const g2 = a.rules['g2'];
    const g3 = a.rules['g3'];
    const g5 = a.rules['g5'];
    const other = a.gFailed - (g1 && !g1.passed ? 1 : 0)
                          - (g2 && !g2.passed ? 1 : 0)
                          - (g3 && !g3.passed ? 1 : 0)
                          - (g5 && !g5.passed ? 1 : 0);
    tokensTotal += a.tokensIn + a.tokensOut;
    // Defensive coercion: every numeric field is coerced through Number() so a
    // missing or non-numeric value (e.g. from an SDK regression) yields 0
    // instead of NaN, which would corrupt the CSV with empty cells.
    const safeNum = (n: unknown): number => {
      const v = Number(n ?? 0);
      return Number.isFinite(v) ? v : 0;
    };
    const safeStr = (s: unknown): string => (s == null ? '' : String(s));
    return {
      prompt_id: prompt.id,
      domain: safeStr(prompt.domain),
      route: safeStr(prompt.route),
      complexity: (prompt.complexity ?? 'medium') as ExperimentRow['complexity'],
      condition: condition as Condition,
      iteration: safeNum(iteration),
      attempt: safeNum(a.attempt),
      passed: !!a.passed,
      final_passed: !!run.passed,
      rules_total: safeNum(a.gPassed + a.gFailed + a.gSkipped),
      rules_passed: safeNum(a.gPassed),
      rules_failed: safeNum(a.gFailed),
      rules_skipped: safeNum(a.gSkipped),
      g1_db_driver: g1 && !g1.passed && !g1.skipped ? 1 : 0,
      g2_auth_missing: g2 && !g2.passed && !g2.skipped ? 1 : 0,
      g3_cross_module: g3 && !g3.passed && !g3.skipped ? 1 : 0,
      g5_ts_errors: g5 && !g5.passed && !g5.skipped ? 1 : 0,
      g_other_failures: safeNum(Math.max(0, other)),
      tokens_in: safeNum(a.tokensIn),
      tokens_out: safeNum(a.tokensOut),
      tokens_total: safeNum(tokensTotal),
      latency_ms: safeNum(a.llmLatencyMs),
      wall_ms: safeNum(a.wallMs),
      provider: safeStr(run.provider),
      model: safeStr(run.model),
      concurrency_slot: safeNum(concurrencySlot),
    };
  });
}

/** Stable column order used by both the JSONL and the CSV writer. */
export const COLUMNS: Array<keyof ExperimentRow> = [
  'prompt_id', 'domain', 'route', 'complexity', 'condition',
  'iteration', 'attempt',
  'passed', 'final_passed',
  'rules_total', 'rules_passed', 'rules_failed', 'rules_skipped',
  'g1_db_driver', 'g2_auth_missing', 'g3_cross_module', 'g5_ts_errors', 'g_other_failures',
  'tokens_in', 'tokens_out', 'tokens_total',
  'latency_ms', 'wall_ms',
  'provider', 'model', 'concurrency_slot',
];

/** Append one row to a newline-delimited JSON file. */
export class JsonlWriter {
  private stream: WriteStream;
  constructor(path: string) {
    this.stream = createWriteStream(path, { flags: 'a' });
  }
  write(row: ExperimentRow): void {
    this.stream.write(JSON.stringify(row) + '\n');
  }
  close(): Promise<void> {
    return new Promise(res => this.stream.end(res));
  }
}

/** Write the column header then a row per record. */
export function writeCsv(path: string, rows: ExperimentRow[]): void {
  const header = COLUMNS.join(',');
  const lines = rows.map(r => COLUMNS.map(c => csvEscape(String(r[c]))).join(','));
  writeFileSync(path, [header, ...lines].join('\n') + '\n', 'utf8');
}

/**
 * Append rows to an existing summary.csv without disturbing the header or
 * the rows already on disk. Used by the resume-aware runner so a partial
 * run (Ctrl+C, key swap, transient 429) keeps the prior data intact.
 *
 * If the file does not exist, a fresh one is written with the header.
 * If it exists but is missing the header, the header is prepended first.
 *
 * Synchronous: the runner calls this at the end of the run when the process
 * is about to exit, so we cannot rely on stream drain callbacks here.
 */
export function appendCsv(path: string, rows: ExperimentRow[]): void {
  if (rows.length === 0) return;
  const body = rows.map(r => COLUMNS.map(c => csvEscape(String(r[c]))).join(',')).join('\n') + '\n';
  if (!existsSync(path)) {
    const header = COLUMNS.join(',') + '\n';
    writeFileSync(path, header + body, 'utf8');
    return;
  }
  const firstLine = readFileSync(path, 'utf8').split('\n')[0] ?? '';
  const expectedHeader = COLUMNS.join(',');
  // Backfill the header if the prior run left a header-only file or the file
  // was wiped mid-flight. The header is what the analyzer parses.
  if (firstLine.trim() !== expectedHeader) {
    const existing = readFileSync(path, 'utf8').replace(/^\n+/, '');
    writeFileSync(path, expectedHeader + '\n' + existing + body, 'utf8');
    return;
  }
  // Normal append: synchronous so the bytes hit disk before process exit.
  appendFileSync(path, body, 'utf8');
}

export function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Compute the simple per-prompt summary: did it pass, how many attempts, total time. */
export interface PromptSummary {
  prompt_id: string;
  condition: Condition;
  passed: boolean;
  attempts_to_pass: number | null;
  total_ms: number;
  final_rule_failures: number;
  g1_first_attempt: number;
  g2_first_attempt: number;
  g3_first_attempt: number;
  g5_first_attempt: number;
}

export function summarizeRun(
  prompt: PromptRecord,
  condition: Condition,
  run: GenerationRun
): PromptSummary {
  const first = run.attempts[0];
  return {
    prompt_id: prompt.id,
    condition,
    passed: run.passed,
    attempts_to_pass: run.attemptsToPass,
    total_ms: run.totalMs,
    final_rule_failures: first ? first.gFailed : 0,
    g1_first_attempt: first?.rules['g1'] && !first.rules['g1'].passed ? 1 : 0,
    g2_first_attempt: first?.rules['g2'] && !first.rules['g2'].passed ? 1 : 0,
    g3_first_attempt: first?.rules['g3'] && !first.rules['g3'].passed ? 1 : 0,
    g5_first_attempt: first?.rules['g5'] && !first.rules['g5'].passed ? 1 : 0,
  };
}
