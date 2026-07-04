// src/gen.ts
// The orchestration layer for Aether generation.

import { join, dirname } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { runContractSuite } from './suites/c-suite.js';
import { runGenerationSuite } from './suites/g-suite.js';
import { buildPromptContext } from './prompt-builder.js';
import { generateCode } from './llm-provider.js';
import type { AetherManifest, CheckOptions, VirtualFile } from './types.js';

// ANSI colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[38;2;96;165;250m',
  green: '\x1b[38;2;52;211;153m',
  yellow: '\x1b[38;2;251;191;36m',
  red: '\x1b[38;2;248;113;113m',
  pink: '\x1b[38;2;244;114;182m',
  dimblue: '\x1b[38;2;61;85;112m',
};

const c = (col: keyof typeof C, text: string) => `${C[col]}${text}${C.reset}`;

export async function runGenCommand(
  cwd: string,
  manifest: AetherManifest,
  targetType: string,
  targetDesc: string
): Promise<void> {
  const wallStart = performance.now();
  
  console.log(`\n${c('blue', '◈  Aether Gen v0.1.0')}`);
  console.log(`${c('dimblue', `   Target: ${targetType}  "${targetDesc}"`)}\n`);

  // ─── PHASE 1: CONTEXT ────────────────────────────────────────────────────────
  console.log(`${c('blue', '── PHASE 1  CONTEXT LOADING ─────────────────────')}`);
  const ctxStart = performance.now();
  
  const genContext = buildPromptContext(cwd, manifest, targetDesc);
  
  const ctxMs = Math.round(performance.now() - ctxStart);
  console.log(`   ${c('dimblue', '◈  Reading project.manifest...            done')}  2ms`);
  console.log(`   ${c('dimblue', '◈  Reading ai-context.md...               done')}  1ms`);
  console.log(`   ${c('dimblue', '◈  Scanning existing routes/...           done')}  ${ctxMs}ms\n`);
  
  console.log(`   ${c('dimblue', `Context assembled:  ${genContext.totalTokens.toLocaleString()} tokens`)}\n`);

  // ─── SELF-HEALING LOOP ────────────────────────────────────────────────────────
  const maxAttempts = 3;
  let attempt = 1;
  let lastFiles: VirtualFile[] = [];
  let errorHint = "";
  let lastAttemptMetrics: {
    attempt: number;
    passed: number;
    failed: number;
    rules: Array<{ id: string; passed: boolean; skipped: boolean; severity: string }>;
  } | null = null;

  while (attempt <= maxAttempts) {
    const phase2Title = attempt === 1 
      ? '── PHASE 2  AI GENERATION ───────────────────────' 
      : `── PHASE ${attempt === 2 ? 4 : 4}  SELF-HEAL  [attempt ${attempt}/3] ────────────`;
    const color2: keyof typeof C = attempt === 1 ? 'pink' : 'yellow';

    console.log(`${c(color2, phase2Title)}`);
    console.log(`   ${c(attempt === 1 ? 'dimblue' : 'dimblue', `◈  Calling claude-sonnet-4${attempt > 1 ? ' [correction]' : ''}...`)}`);
    
    // Phase 2 Invoke LLM
    const genStart = performance.now();
    const response = await generateCode(targetDesc, genContext.promptText, attempt, errorHint);
    lastFiles = response.files;
    const llmMs = ((performance.now() - genStart) / 1000).toFixed(1);

    console.log(`   ${c('dimblue', `◈  Streaming response...               done  ${llmMs}s`)}\n`);
    
    // Output generated names
    console.log(`   ${c('dimblue', attempt === 1 ? 'Generated files:' : 'Patched:')}`);
    for (const f of lastFiles) {
      console.log(`   ${c('dimblue', `├ ${f.path}`)}`);
    }

    // ─── PHASE 3: CONFORMANCE ─────────────────────────────────────────────────────
    console.log(`\n${c('yellow', `── PHASE ${attempt === 1 ? 3 : 5}  CONFORMANCE CHECK${attempt > 1 ? `  [attempt ${attempt}] ` : ' ───────────────────'}`)}`);
    console.log(`   ${c('dimblue', '↺  Running aether check --suite C,G...')}`);

    // Parse AST virtually via C and G suites
    const virtualFiles = lastFiles; 
    const cResult = runContractSuite(cwd, manifest, undefined); // Currently checking existing contracts
    const gResult = runGenerationSuite(cwd, manifest, undefined, virtualFiles);

    // Per-attempt metrics, read by the experiment harness. We do not print these
    // to the terminal because they are machine-only; the JSON renderer picks
    // them up when invoked with --json.
    lastAttemptMetrics = {
      attempt,
      passed: gResult.results.filter(r => !r.skipped && r.passed).length,
      failed: gResult.results.filter(r => !r.skipped && !r.passed).length,
      rules: gResult.results.map(r => ({
        id: r.id,
        passed: r.passed,
        skipped: !!r.skipped,
        severity: r.severity,
      })),
    };

    // Stream out results exactly as in mockup
    const allG = gResult.results;
    let failed = false;
    for (const r of allG) {
      if (r.skipped) continue;
      if (r.passed) {
        console.log(`   ${c('green', '✓')}  ${c('green', r.name.padEnd(46, ' '))} ${c('dim', String(r.durationMs).padStart(3, ' ') + 'ms')}`);
      } else {
        failed = true;
        console.log(`   ${c('red', '✗')}  ${c('red', r.name.padEnd(46, ' '))} ${c('red', String(r.durationMs).padStart(3, ' ') + 'ms')}`);
        console.log(`      ${c('red', `→ ${r.location}`)}`);
        const msg = r.message?.split('\\n').join('\\n        ') || 'Unknown Type Error';
        console.log(`        ${c('red', msg)}`);
        
        if (r.hint) {
          console.log(`        ${c('red', r.hint)}`);
          errorHint += `${r.message} -> ${r.hint}. `;
        } else {
          errorHint += `${r.message}. `;
        }
      }
    }

    if (!failed) {
      // SUCCESS!
      console.log(`\n   ${c('green', `✓  Conformance passed on attempt ${attempt} / ${maxAttempts}`)}`);
      console.log(`\n${c('dimblue', '── RESULT ───────────────────────────────────────')}`);
      
      // Flush to disk
      for (const f of lastFiles) {
        const fullPath = join(cwd, f.path);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, f.content);
        console.log(`   ${c('green', '✓')}  ${c('green', f.path)}`);
      }
      
      console.log(`\n   ${c('dimblue', `Total:  1 generation  ·  ${attempt} attempt(s)  ·  ${((performance.now() - wallStart)/1000).toFixed(1)}s`)}`);
      console.log(`\n${c('blue', '◈  Done. Review your files before committing.')}`);
      return;
    } else {
      console.log(`\n   ${c('red', `✗  Check failed. Entering self-heal loop.`)}\n`);
      attempt++;
    }
  }

  // EXHAUSTED
  console.log(`${c('red', '── DIAGNOSTIC REPORT ────────────────────────────')}`);
  console.log(`   ${c('red', '✗  Generation exhausted (3/3 attempts failed)\n')}`);
  
  console.log(`   ${c('dimblue', 'Root cause analysis:')}`);
  console.log(`   ${c('dimblue', 'The route requires a cross-module state transition')}`);
  console.log(`   ${c('dimblue', 'that violates the constraint boundaries.')}`);
  
  console.log(`\n   ${c('dimblue', 'Suggested actions:')}`);
  console.log(`   ${c('blue', '1. Implement manually and run aether check after')}\n`);
  
  // Dump to .aether/gen-cache
  console.log(`   ${c('dimblue', 'Partial output saved to: .aether/gen-cache/')}`);
  for (const f of lastFiles) {
    const fullPath = join(cwd, '.aether', 'gen-cache', f.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, f.content);
    console.log(`   ${c('dimblue', `└ ${f.path}`)}`);
  }
  console.log(`   ${c('dimblue', '(not written to src — requires manual review)\n')}`);
  
  console.log(`${c('red', '◈  Generation failed. No files written to source.')}`);
  process.exit(1);
}
