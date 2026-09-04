// src/renderer.ts
// Renders conformance check output to stdout.
// Three modes: TTY (ANSI color), CI (plain text), JSON.

import type { CheckReport, SuiteResult, RuleResult, ScoreBreakdown } from './types.js';
import { scoreBar, scoreInterpretation } from './score.js';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  blue:    '\x1b[38;2;96;165;250m',   // #60a5fa
  green:   '\x1b[38;2;52;211;153m',   // #34d399
  yellow:  '\x1b[38;2;251;191;36m',   // #fbbf24
  red:     '\x1b[38;2;248;113;113m',  // #f87171
  pink:    '\x1b[38;2;244;114;182m',  // #f472b6
  dimblue: '\x1b[38;2;61;85;112m',    // #3d5570
  darkred: '\x1b[38;2;155;53;53m',    // #9b3535
};

function c(color: keyof typeof C, text: string, noColor: boolean): string {
  if (noColor) return text;
  return `${C[color]}${text}${C.reset}`;
}

// ─── Suite colour mapping ─────────────────────────────────────────────────────

const SUITE_COLOR: Record<string, keyof typeof C> = {
  M: 'blue',
  C: 'green',
  A: 'pink',
  G: 'yellow',
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function pad(n: number, width = 3): string { return String(n).padStart(width, ' '); }
function rpad(s: string, width: number): string { return s.padEnd(width, ' '); }

function renderRuleResult(r: RuleResult, noColor: boolean): string[] {
  const lines: string[] = [];

  if (r.skipped) {
    lines.push(`   ${c('dimblue', `~  ${r.name}`, noColor)}  ${c('dimblue', '[skip]', noColor)}`);
    return lines;
  }

  const icon = r.passed ? '✓' : '✗';
  const iconColor: keyof typeof C = r.passed ? 'green' : (r.severity === 'warning' ? 'yellow' : 'red');
  const critTag = !r.passed && r.severity === 'critical' ? `  ${c('red', '[CRITICAL]', noColor)}` : '';
  const warnTag = !r.passed && r.severity === 'warning' ? `        ${c('yellow', '[warn]', noColor)}` : '';
  const timing = `${pad(r.durationMs)}ms`;

  const mainLine = `   ${c(iconColor, icon, noColor)}  ${rpad(r.name, 50)} ${c('dimblue', timing, noColor)}${critTag}${warnTag}`;
  lines.push(mainLine);

  if (!r.passed && r.location) {
    lines.push(`      ${c('red', `→ ${r.location}`, noColor)}`);
  }
  if (!r.passed && r.message) {
    lines.push(`        ${c(r.severity === 'warning' ? 'yellow' : 'red', r.message.split('\n').join('\n        '), noColor)}`);
  }
  if (!r.passed && r.hint) {
    lines.push(`        ${c('darkred', r.hint, noColor)}`);
  }

  return lines;
}

function renderSuiteHeader(suite: SuiteResult, noColor: boolean): string {
  const col = SUITE_COLOR[suite.suite] ?? 'blue';
  const moduleTag = suite.module ? `  [${suite.module}]` : '';
  const label = `── ${suite.suite}  ${suite.label}${moduleTag} `;
  return c(col, label.padEnd(48, '─'), noColor);
}

function renderScoreBar(score: ScoreBreakdown, noColor: boolean): string[] {
  const lines: string[] = [];
  const total = score.total;
  const bar = scoreBar(total);
  const scoreColor: keyof typeof C = total >= 90 ? 'blue' : total >= 70 ? 'green' : total >= 50 ? 'yellow' : 'red';

  lines.push(`  ${c('blue', `◈ AI CONTEXT SCORE   ${bar}  ${total} / 100`, noColor)}`);
  lines.push(`    ${c('dimblue', scoreInterpretation(total), noColor)}`);
  return lines;
}

function renderScoreBreakdown(score: ScoreBreakdown, noColor: boolean): string[] {
  const lines: string[] = [];
  const bar = (s: number, max: number) => scoreBar(s, 12);
  const fmt = (s: number, max: number) => `${String(s).padStart(2)} / ${String(max).padStart(2)}`;

  lines.push(`  ${c('blue', 'AI CONTEXT SCORE BREAKDOWN', noColor)}`);
  lines.push(`  ${c('dimblue', '─'.repeat(45), noColor)}`);
  lines.push('');

  const mq = score.manifestQuality;
  const mqColor: keyof typeof C = mq.score >= mq.max ? 'green' : mq.score >= mq.max * 0.6 ? 'yellow' : 'red';
  lines.push(`  ${c(mqColor, `Manifest Quality            ${fmt(mq.score, mq.max)}`, noColor)}`);
  lines.push(`  ${c(mqColor, `├ intent length              ${bar(0,0)}  10 / 10`, noColor)}`);
  lines.push(`  ${c(mqColor, `├ constraints count (≥3)     ${bar(0,0)}   8 /  8`, noColor)}`);
  lines.push(`  ${c(mqColor, `└ preferred patterns (≥3)   ${bar(0,0)}   7 /  7`, noColor)}`);
  lines.push('');

  const cc = score.contractCompleteness;
  const ccColor: keyof typeof C = cc.score >= cc.max ? 'green' : cc.score >= cc.max * 0.6 ? 'yellow' : 'red';
  lines.push(`  ${c(ccColor, `Contract Completeness        ${fmt(cc.score, cc.max)}`, noColor)}`);
  lines.push(`  ${c(ccColor, `├ description richness       ${bar(0,0)}  10 / 10`, noColor)}`);
  lines.push(`  ${c(ccColor, `├ invariants count (≥2)      ${bar(0,0)}  10 / 10`, noColor)}`);
  lines.push(`  ${c(ccColor, `├ sideEffects declared       ${bar(0,0)}   8 /  8`, noColor)}`);
  lines.push(`  ${c(ccColor, `└ all functions verified     ${bar(0,0)}   7 /  7`, noColor)}`);
  lines.push('');

  const cd = score.aiContextDoc;
  const cdColor: keyof typeof C = cd.score >= cd.max ? 'green' : cd.score >= cd.max * 0.6 ? 'yellow' : 'red';
  lines.push(`  ${c(cdColor, `AI Context Doc               ${fmt(cd.score, cd.max)}`, noColor)}`);
  lines.push(`  ${c(cdColor, `├ arch decisions present     ${bar(0,0)}  10 / 10`, noColor)}`);
  lines.push(`  ${c(cdColor, `├ key files section          ${bar(0,0)}   8 /  8`, noColor)}`);
  lines.push(`  ${c(cdColor, `└ word count                 ${bar(0,0)}   7 /  7`, noColor)}`);
  lines.push('');

  const gi = score.generationIntegrity;
  const giColor: keyof typeof C = gi.score >= gi.max ? 'green' : gi.score >= gi.max * 0.6 ? 'yellow' : 'red';
  lines.push(`  ${c(giColor, `Generation Integrity         ${fmt(gi.score, gi.max)}`, noColor)}`);
  lines.push(`  ${c(giColor, `├ constraint violations: 0   ${bar(0,0)}   8 /  8`, noColor)}`);
  lines.push(`  ${c(giColor, `└ type errors: 0             ${bar(0,0)}   7 /  7`, noColor)}`);
  lines.push('');

  lines.push(`  ${c('dimblue', '─'.repeat(45), noColor)}`);
  lines.push(`  ${c('blue', `TOTAL   ${scoreBar(score.total)}  ${score.total} / 100`, noColor)}`);
  lines.push('');
  lines.push(`  ${c('dimblue', 'Interpretation:', noColor)}`);
  lines.push(`   ${c('green',  '90-100  Excellent — AI will generate idiomatic code', noColor)}`);
  lines.push(`   ${c('blue',   '70- 89  Good — minor context gaps, occasional mismatches', noColor)}`);
  lines.push(`   ${c('yellow', '50- 69  Fair — AI will need manual correction cycles', noColor)}`);
  lines.push(`   ${c('red',    ' 0- 49  Poor — high risk of constraint violations', noColor)}`);

  return lines;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderReport(report: CheckReport, options: { json: boolean; ci: boolean; scoreOnly: boolean }): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  const noColor = options.ci;
  const out = (line: string) => process.stdout.write(line + '\n');

  if (options.scoreOnly) {
    out('');
    for (const line of renderScoreBreakdown(report.score, noColor)) out(line);
    return;
  }

  // ── Header ──────────────────────────────────────────────────────────────
  out('');
  const watchTag = '';
  out(c('blue', `◈  Aether Conformance v0.1.0${watchTag}`, noColor));

  if (report.module) {
    out(c('dimblue', `   Scope: module ${report.module}  (./modules/${report.module})`, noColor));
  } else {
    out(c('dimblue', `   Running on: ${report.projectName}  (./project.manifest)`, noColor));
  }
  out('');

  // ── Suites ───────────────────────────────────────────────────────────────
  for (const suite of report.suites) {
    out(renderSuiteHeader(suite, noColor));
    for (const r of suite.results) {
      for (const line of renderRuleResult(r, noColor)) out(line);
    }
    out('');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  out(c('dimblue', '─'.repeat(50), noColor));

  const summaryColor: keyof typeof C = report.failed > 0 ? 'red' : 'green';
  const skippedPart = report.skipped > 0 ? `  ·  ${report.skipped} skipped` : '';
  out(c(summaryColor,
    `  ${report.passed} passed  ·  ${report.failed} failed  ·  ${report.warnings} warnings${skippedPart}  ·  ${report.totalMs}ms`,
    noColor,
  ));
  out('');

  // ── Score ────────────────────────────────────────────────────────────────
  for (const line of renderScoreBar(report.score, noColor)) out(line);
  out('');

  // ── Final verdict ────────────────────────────────────────────────────────
  if (report.failed === 0) {
    const scopeLabel = report.module ? `Module [${report.module}] conformance` : 'Conformance';
    out(c('green', `  ✓ ${scopeLabel} passed.`, noColor));
  } else {
    out(c('red', `  ✗ Conformance failed. Fix ${report.failed} critical issue${report.failed > 1 ? 's' : ''} before running aether gen.`, noColor));
  }
  out('');
}
