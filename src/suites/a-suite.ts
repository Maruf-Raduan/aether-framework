// src/suites/a-suite.ts
// A — AI Context Suite
// Validates ai-context.md for completeness and AI-readability.
// Uses regex/string analysis — no AST.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { RuleResult, SuiteResult, AetherManifest } from '../types.js';

function rule(
  id: string,
  name: string,
  severity: 'critical' | 'warning' | 'info',
  aiImpact: 'high' | 'medium' | 'low',
  fn: () => { passed: boolean; message?: string; location?: string; hint?: string },
): RuleResult {
  const start = performance.now();
  try {
    const res = fn();
    return {
      id, name, passed: res.passed, severity, aiImpact,
      durationMs: Math.round(performance.now() - start),
      message: res.message,
      location: res.location,
      hint: res.hint,
    };
  } catch (e) {
    return {
      id, name, passed: false, severity, aiImpact,
      durationMs: Math.round(performance.now() - start),
      message: `Internal error: ${String(e)}`,
    };
  }
}

export function runAiContextSuite(
  cwd: string,
  manifest: AetherManifest,
): SuiteResult {
  const start = performance.now();
  const results: RuleResult[] = [];

  const contextPath = manifest.ai?.context;
  const absPath = contextPath ? resolve(cwd, contextPath) : null;
  const content = (absPath && existsSync(absPath)) ? readFileSync(absPath, 'utf-8') : null;
  const contextFile = contextPath ?? './ai-context.md';

  // A1: contains ## Architecture decisions section
  results.push(rule('a1', 'contains ## Architecture decisions section', 'critical', 'high', () => {
    if (!content) return { passed: false, message: `${contextFile} could not be read`, location: contextFile };
    const has = /^##\s+Architecture decisions/im.test(content);
    return {
      passed: has,
      message: !has ? `No "## Architecture decisions" section found in ${contextFile}` : undefined,
      location: !has ? contextFile : undefined,
      hint: !has ? 'AI impact: HIGH — AI will override architecture decisions it does not understand' : undefined,
    };
  }));

  // A2: contains ## Key files section
  results.push(rule('a2', 'contains ## Key files section', 'critical', 'high', () => {
    if (!content) return { passed: false, message: `${contextFile} could not be read`, location: contextFile };
    const has = /^##\s+Key files/im.test(content);
    return {
      passed: has,
      message: !has ? `No "## Key files" section found in ${contextFile}` : undefined,
      location: !has ? contextFile : undefined,
      hint: !has ? 'AI will regenerate shared utilities it cannot see — duplicate implementations ensue' : undefined,
    };
  }));

  // A3: contains ## Things AI commonly gets wrong section (warning, not critical)
  results.push(rule('a3', 'contains ## Things AI commonly gets wrong section', 'warning', 'high', () => {
    if (!content) return { passed: false, message: `${contextFile} could not be read`, location: contextFile };
    const has = /^##\s+Things AI commonly gets wrong/im.test(content);
    return {
      passed: has,
      message: !has ? `No "## Things AI commonly gets wrong" section in ${contextFile}` : undefined,
      location: !has ? contextFile : undefined,
      hint: !has ? 'Pre-emptive correction is more reliable than reactive correction' : undefined,
    };
  }));

  // A4: all /lib/ paths mentioned in context exist on disk
  results.push(rule('a4', 'all /lib/ paths in context exist on disk', 'critical', 'medium', () => {
    if (!content) return { passed: false, message: `${contextFile} could not be read` };
    // Match paths like /lib/db.ts, /lib/auth.ts etc.
    const libPathRegex = /`?(\/lib\/[\w./\-]+\.ts)`?/g;
    const matches = [...content.matchAll(libPathRegex)].map(m => m[1]);
    const unique = [...new Set(matches)];
    const missing = unique.filter(p => !existsSync(resolve(cwd, p.replace(/^\//, ''))));
    return {
      passed: missing.length === 0,
      message: missing.length > 0
        ? `Stale paths in ${contextFile}: ${missing.join(', ')}`
        : undefined,
      hint: missing.length > 0 ? 'AI will generate imports that resolve to nothing' : undefined,
    };
  }));

  // A5: word count ≥ 200 (warning)
  results.push(rule('a5', 'word count ≥ 200', 'warning', 'medium', () => {
    if (!content) return { passed: false, message: `${contextFile} could not be read` };
    const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    return {
      passed: words >= 200,
      message: words < 200
        ? `${contextFile}: ${words} words (minimum: 200)`
        : undefined,
      hint: words < 200 ? 'Minimal context docs produce generic, pattern-mismatched code' : undefined,
    };
  }));

  return {
    suite: 'A',
    label: 'AI CONTEXT',
    results,
    durationMs: Math.round(performance.now() - start),
  };
}
