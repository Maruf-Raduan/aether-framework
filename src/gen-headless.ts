// src/gen-headless.ts
// Headless variant of the generation loop. Same logic as src/gen.ts, but
// instead of writing files and printing to stdout it returns a structured
// `GenerationRun` describing every attempt, every rule outcome, and every
// file produced. This is what the experiment runner calls so it can compare
// conditions (vanilla vs aether) without dealing with the terminal UI.

import { runContractSuite } from './suites/c-suite.js';
import { runGenerationSuite } from './suites/g-suite.js';
import { buildPromptContext } from './prompt-builder.js';
import { generateCode } from './llm-provider.js';
import { getProvider } from './providers/index.js';
import type { AetherManifest, SuiteResult, VirtualFile } from './types.js';

export interface AttemptMetrics {
  attempt: number;
  passed: boolean;
  /** Number of G-suite rules that passed on this attempt. */
  gPassed: number;
  /** Number of G-suite rules that failed on this attempt. */
  gFailed: number;
  /** Number of G-suite rules skipped on this attempt. */
  gSkipped: number;
  /** Total LLM latency for this attempt, in ms. */
  llmLatencyMs: number;
  /** Tokens billed for the input prompt on this attempt. */
  tokensIn: number;
  /** Tokens billed for the model output on this attempt. */
  tokensOut: number;
  /** Total wall time for this attempt (LLM + AST + suites), in ms. */
  wallMs: number;
  /** Per-rule outcomes keyed by rule id, e.g. "g2" → {passed, message}. */
  rules: Record<string, { passed: boolean; skipped: boolean; message?: string; hint?: string }>;
  /** Files the LLM produced on this attempt. */
  files: VirtualFile[];
  /** Accumulated error hint that was fed into the next attempt. */
  errorHint: string;
}

export interface GenerationRun {
  promptId?: string;
  targetDesc: string;
  provider: string;
  model: string;
  attempts: AttemptMetrics[];
  /** True iff at least one attempt passed. */
  passed: boolean;
  /** Number of attempts it took to pass (matches attempts.length when failed). */
  attemptsToPass: number | null;
  /** Total wall time across all attempts. */
  totalMs: number;
  /** Final files written (the last attempt's output). */
  finalFiles: VirtualFile[];
  /** Full C-suite result from the first attempt — for cross-rule analysis. */
  contractSuite: SuiteResult;
  /** Full G-suite result from the final attempt — for cross-rule analysis. */
  finalGenerationSuite: SuiteResult;
}

export interface RunOptions {
  /** Override which provider to use (skips env detection). */
  provider?: string;
  /** Override the model id passed to the provider. */
  model?: string;
  /** Hard cap on self-healing attempts. Defaults to 3 to match gen.ts. */
  maxAttempts?: number;
  /** Optional prompt id, propagated into the result for the harness. */
  promptId?: string;
  /** Pre-assembled prompt text. When omitted, buildPromptContext() is used. */
  promptText?: string;
  /** When true, the C-suite check is skipped. Vanilla baseline uses this. */
  skipContractSuite?: boolean;
}

export async function runGeneration(
  cwd: string,
  manifest: AetherManifest,
  targetDesc: string,
  opts: RunOptions = {}
): Promise<GenerationRun> {
  const wallStart = performance.now();
  const maxAttempts = opts.maxAttempts ?? 3;
  const provider = getProvider(opts.provider);

  // 1. Assemble prompt. The harness may inject its own text (vanilla baseline
  //    passes a generic preamble; aether harness uses the real Aether context).
  const promptText = opts.promptText ?? buildPromptContext(cwd, manifest, targetDesc).promptText;

  const attempts: AttemptMetrics[] = [];
  let lastFiles: VirtualFile[] = [];
  let lastContract: SuiteResult = { suite: 'C', label: 'CONTRACT', results: [], durationMs: 0 };
  let lastGeneration: SuiteResult = { suite: 'G', label: 'GENERATION', results: [], durationMs: 0 };
  let errorHint = '';
  let didPass = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStart = performance.now();

    const response = await generateCode(targetDesc, promptText, attempt, errorHint, {
      provider: opts.provider,
      model: opts.model,
    });
    const llmLatencyMs = response.latencyMs;
    // Defensive: the provider contract is `tokensIn/tokensOut: number`, but if
    // a future adapter or SDK regression returns `undefined`, coerce to 0
    // rather than letting NaN propagate into the metrics CSV.
    const tokensIn = Number(response.tokensIn ?? 0) || 0;
    const tokensOut = Number(response.tokensOut ?? 0) || 0;
    lastFiles = response.files;

    const cResult = opts.skipContractSuite
      ? lastContract
      : runContractSuite(cwd, manifest, undefined);
    const gResult = runGenerationSuite(cwd, manifest, undefined, lastFiles);

    lastContract = cResult;
    lastGeneration = gResult;

    const ruleMap: AttemptMetrics['rules'] = {};
    let gPassed = 0, gFailed = 0, gSkipped = 0;
    for (const r of gResult.results) {
      if (r.skipped) gSkipped++;
      else if (r.passed) gPassed++;
      else gFailed++;
      ruleMap[r.id] = {
        passed: r.passed,
        skipped: !!r.skipped,
        message: r.message,
        hint: r.hint,
      };
    }

    const attemptFailed = gFailed > 0;
    const wallMs = Math.round(performance.now() - attemptStart);

    attempts.push({
      attempt,
      passed: !attemptFailed,
      gPassed,
      gFailed,
      gSkipped,
      llmLatencyMs,
      tokensIn,
      tokensOut,
      wallMs,
      rules: ruleMap,
      files: lastFiles,
      errorHint,
    });

    if (!attemptFailed) {
      didPass = true;
      break;
    }

    // Build the hint for the next attempt from the failed rules.
    errorHint = gResult.results
      .filter(r => !r.skipped && !r.passed)
      .map(r => `[${r.id}] ${r.message}${r.hint ? ` → ${r.hint}` : ''}`)
      .join('\n');
  }

  const passedAttempt = attempts.find(a => a.passed);
  return {
    promptId: opts.promptId,
    targetDesc,
    provider: provider.id,
    model: opts.model ?? provider.defaultModel,
    attempts,
    passed: didPass,
    attemptsToPass: passedAttempt ? passedAttempt.attempt : null,
    totalMs: Math.round(performance.now() - wallStart),
    finalFiles: passedAttempt?.files ?? lastFiles,
    contractSuite: lastContract,
    finalGenerationSuite: lastGeneration,
  };
}
