// experiments/runner/vanilla.ts
// Vanilla baseline condition. We give the LLM nothing but a short preamble
// plus the feature description — no Aether manifest, no module contracts, no
// ai-context.md. This is the "naked LLM" condition: what a developer gets
// when they paste a prompt into Claude or ChatGPT without any project-level
// scaffolding. After the model produces files we still run the same G-suite
// conformance check used by the Aether condition; otherwise the comparison
// would be meaningless because each condition would be judged by a different
// yardstick.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadManifest } from '../../src/manifest.js';
import { runGeneration } from '../../src/gen-headless.js';
import type { AetherManifest } from '../../src/types.js';
import type { GenerationRun } from '../../src/gen-headless.js';

export interface PromptRecord {
  id: string;
  domain: string;
  route: string;
  complexity: 'low' | 'medium' | 'high';
  target_rules: string[];
  description: string;
  edge_case: string;
}

/** The exact preamble we hand to the model. Intentionally short and generic. */
export const VANILLA_PREAMBLE =
  'You are a senior TypeScript engineer. Implement the feature described below. ' +
  'Use sensible defaults for the runtime (Node + Hono is fine), ' +
  'do not import any framework-specific response helpers, and do not worry about ' +
  'project-specific conventions — none have been declared for this exercise. ' +
  'Return each new file inside a fenced code block tagged `aether:<path>` so the ' +
  'evaluation harness can pick them up.';

/**
 * Run a single prompt under the vanilla condition. Returns the same shape as
 * `runGeneration()` so the downstream metrics and analysis code can treat
 * both conditions uniformly.
 */
export async function runVanilla(
  cwd: string,
  prompt: PromptRecord,
  manifest: AetherManifest,
  opts: { provider?: string; model?: string } = {}
): Promise<GenerationRun> {
  const promptText = `${VANILLA_PREAMBLE}\n\nFEATURE: ${prompt.description}\n`;
  return runGeneration(cwd, manifest, prompt.description, {
    provider: opts.provider,
    model: opts.model,
    promptId: prompt.id,
    promptText,
    maxAttempts: 1, // no self-healing under the vanilla condition
    skipContractSuite: true,
  });
}

/** CLI entry — lets you run a single prompt from the command line for smoke tests. */
export async function main(argv: string[]): Promise<void> {
  const cwd = process.cwd();
  const promptArg = argv.find(a => a.startsWith('--prompt='))?.slice('--prompt='.length);
  const providerArg = argv.find(a => a.startsWith('--provider='))?.slice('--provider='.length);
  if (!promptArg) {
    console.error('Usage: tsx experiments/runner/vanilla.ts --prompt=P07 [--provider=mock|gemini]');
    process.exit(2);
  }

  const manifestPath = resolve(cwd, 'project.manifest');
  if (!existsSync(manifestPath)) {
    console.error('project.manifest not found in', cwd);
    process.exit(2);
  }
  const manifest = (await loadManifest(cwd)) as AetherManifest;

  const promptsPath = resolve(cwd, 'experiments/prompts/prompts.jsonl');
  const lines = readFileSync(promptsPath, 'utf8').split('\n').filter(Boolean);
  const prompt = lines
    .map(l => JSON.parse(l) as PromptRecord)
    .find(p => p.id === promptArg);

  if (!prompt) {
    console.error(`Prompt ${promptArg} not found in prompts.jsonl`);
    process.exit(2);
  }

  const run = await runVanilla(cwd, prompt, manifest, { provider: providerArg });
  console.log(JSON.stringify({
    id: prompt.id,
    passed: run.passed,
    attempts: run.attempts,
    totalMs: run.totalMs,
    provider: run.provider,
    model: run.model,
  }, null, 2));
}

// Auto-run when invoked via tsx.
const invokedDirectly = process.argv[1] && /vanilla\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
