// experiments/runner/aether.ts
// Aether condition. We give the model the full Aether prompt context:
//   - project.manifest
//   - module.contract.ts for the module this feature belongs to
//   - ai-context.md
// and we let the self-healing loop run for up to 3 attempts. This is the
// "developer-with-Aether" condition.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadManifest } from '../../src/manifest.js';
import { runGeneration } from '../../src/gen-headless.js';
import type { AetherManifest } from '../../src/types.js';
import type { GenerationRun } from '../../src/gen-headless.js';
import type { PromptRecord } from './vanilla.js';

/**
 * Resolve the target module for a prompt. Prompts whose route starts with
 * `modules/<m>/` map to that module; otherwise we use the manifest's first
 * module as a fallback so we still have a valid contract to read.
 */
function resolveModuleName(manifest: AetherManifest, route: string): string {
  const m = route.match(/^modules\/([^/]+)\//);
  if (m) return m[1];
  return manifest.modules?.[0]?.name ?? 'tasks';
}

/**
 * Build a prompt text that mirrors what `buildPromptContext` does, but in a
 * self-contained way so the harness can swap in custom content (e.g. to
 * scope the prompt to a specific module for this prompt).
 *
 * Returns the prompt text only — `runGeneration` will pass it through to the
 * LLM unchanged.
 */
export function buildAetherPrompt(cwd: string, manifest: AetherManifest, prompt: PromptRecord): string {
  const moduleName = resolveModuleName(manifest, prompt.route);
  const contractPath = resolve(cwd, 'modules', moduleName, 'module.contract.ts');
  const aiContextPath = resolve(cwd, 'ai-context.md');

  const sections: string[] = [];
  sections.push(`PROJECT: ${manifest.name} (v${manifest.version})`);
  sections.push(`STACK: ${manifest.stack.runtime} + ${manifest.stack.language}`);
  if (existsSync(contractPath)) {
    sections.push('── MODULE CONTRACT ──');
    sections.push(readFileSync(contractPath, 'utf8'));
  }
  if (existsSync(aiContextPath)) {
    sections.push('── AI CONTEXT ──');
    sections.push(readFileSync(aiContextPath, 'utf8'));
  }
  sections.push('── FEATURE REQUEST ──');
  sections.push(prompt.description);
  sections.push('── EDGE CASE TO GUARD AGAINST ──');
  sections.push(prompt.edge_case);
  sections.push('Return each new file inside a fenced code block tagged `aether:<path>`.');
  return sections.join('\n\n');
}

/** Run a single prompt under the Aether condition. */
export async function runAether(
  cwd: string,
  prompt: PromptRecord,
  manifest: AetherManifest,
  opts: { provider?: string; model?: string; maxAttempts?: number } = {}
): Promise<GenerationRun> {
  const promptText = buildAetherPrompt(cwd, manifest, prompt);
  return runGeneration(cwd, manifest, prompt.description, {
    provider: opts.provider,
    model: opts.model,
    promptId: prompt.id,
    promptText,
    maxAttempts: opts.maxAttempts ?? 3,
  });
}

/** CLI entry for smoke-testing. */
export async function main(argv: string[]): Promise<void> {
  const cwd = process.cwd();
  const promptArg = argv.find(a => a.startsWith('--prompt='))?.slice('--prompt='.length);
  const providerArg = argv.find(a => a.startsWith('--provider='))?.slice('--provider='.length);
  if (!promptArg) {
    console.error('Usage: tsx experiments/runner/aether.ts --prompt=P07 [--provider=mock|gemini]');
    process.exit(2);
  }
  const manifest = (await loadManifest(cwd)) as AetherManifest;
  const promptsPath = resolve(cwd, 'experiments/prompts/prompts.jsonl');
  const lines = readFileSync(promptsPath, 'utf8').split('\n').filter(Boolean);
  const prompt = lines.map(l => JSON.parse(l) as PromptRecord).find(p => p.id === promptArg);
  if (!prompt) {
    console.error(`Prompt ${promptArg} not found in prompts.jsonl`);
    process.exit(2);
  }
  const run = await runAether(cwd, prompt, manifest, { provider: providerArg });
  console.log(JSON.stringify({
    id: prompt.id,
    passed: run.passed,
    attempts: run.attempts,
    totalMs: run.totalMs,
    provider: run.provider,
    model: run.model,
  }, null, 2));
}

const invokedDirectly = process.argv[1] && /aether\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}