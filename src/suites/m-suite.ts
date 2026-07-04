// src/suites/m-suite.ts
// M — Manifest Suite
// Validates project.manifest structure, completeness, and internal consistency.
// Uses fs only — no AST parsing.

import { existsSync, statSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { valid as semverValid } from 'semver';
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

export function runManifestSuite(
  cwd: string,
  manifest: AetherManifest,
): SuiteResult {
  const start = performance.now();
  const results: RuleResult[] = [];

  // M1: manifest exists at project root
  results.push(rule('m1', 'manifest exists at project root', 'critical', 'high', () => ({
    passed: existsSync(join(cwd, 'project.manifest')),
    message: !existsSync(join(cwd, 'project.manifest'))
      ? 'project.manifest not found — AI tools have no context entry point'
      : undefined,
  })));

  // M2: required top-level fields present
  const requiredFields = ['name', 'version', 'aether', 'intent', 'stack', 'patterns', 'modules', 'ai'];
  results.push(rule('m2', 'required top-level fields present', 'critical', 'high', () => {
    const missing = requiredFields.filter(f => !(f in (manifest as Record<string, unknown>)));
    return {
      passed: missing.length === 0,
      message: missing.length > 0 ? `Missing fields: ${missing.join(', ')}` : undefined,
      hint: missing.includes('intent') ? "'intent' is the most important field for AI generation" : undefined,
    };
  }));

  // M3: aether version is semver
  results.push(rule('m3', 'aether version is semver', 'critical', 'low', () => {
    const v = manifest.aether;
    const valid = typeof v === 'string' && semverValid(v) !== null;
    return {
      passed: valid,
      message: !valid ? `aether: "${v}" is not a valid semver string (e.g. "0.1.0")` : undefined,
    };
  }));

  // M4: intent field is non-empty string ≥ 20 chars
  results.push(rule('m4', 'intent field is non-empty string ≥ 20 chars', 'critical', 'high', () => {
    const intent = manifest.intent;
    const valid = typeof intent === 'string' && intent.trim().length >= 20;
    return {
      passed: valid,
      message: !valid
        ? `intent is ${typeof intent === 'string' ? intent.trim().length : 0} chars (minimum: 20). A short intent gives AI no useful grounding.`
        : undefined,
    };
  }));

  // M5: each module path exists on disk
  results.push(rule('m5', 'each module path exists on disk', 'critical', 'high', () => {
    if (!Array.isArray(manifest.modules)) return { passed: false, message: 'modules is not an array' };
    const missing = manifest.modules.filter(m => {
      const absPath = join(cwd, m.path.replace(/^\//, ''));
      return !existsSync(absPath) || !statSync(absPath).isDirectory();
    });
    return {
      passed: missing.length === 0,
      message: missing.length > 0
        ? `Module paths not found on disk: ${missing.map(m => m.path).join(', ')}`
        : undefined,
      hint: missing.length > 0 ? 'Create the missing directories or remove them from the modules registry' : undefined,
    };
  }));

  // M6: each module has a module.contract.ts
  results.push(rule('m6', 'each module has a module.contract.ts', 'critical', 'high', () => {
    if (!Array.isArray(manifest.modules)) return { passed: false, message: 'modules is not an array' };
    const missing = manifest.modules.filter(m => {
      const contractPath = join(cwd, m.path.replace(/^\//, ''), 'module.contract.ts');
      return !existsSync(contractPath);
    });
    return {
      passed: missing.length === 0,
      message: missing.length > 0
        ? `Modules missing module.contract.ts: ${missing.map(m => m.name).join(', ')}`
        : undefined,
    };
  }));

  // M7: no duplicate module names
  results.push(rule('m7', 'no duplicate module names', 'critical', 'medium', () => {
    if (!Array.isArray(manifest.modules)) return { passed: false, message: 'modules is not an array' };
    const names = manifest.modules.map(m => m.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    return {
      passed: dupes.length === 0,
      message: dupes.length > 0
        ? `Duplicate module names: ${[...new Set(dupes)].join(', ')}`
        : undefined,
    };
  }));

  // M8: ai.context file exists and is non-empty
  results.push(rule('m8', 'ai.context file exists and is non-empty', 'critical', 'high', () => {
    const contextPath = manifest.ai?.context;
    if (!contextPath) return { passed: false, message: 'ai.context is missing from manifest' };
    const absPath = resolve(cwd, contextPath);
    if (!existsSync(absPath)) {
      return { passed: false, message: `ai.context file not found: ${contextPath}` };
    }
    const content = readFileSync(absPath, 'utf-8');
    const empty = content.trim().length === 0;
    return {
      passed: !empty,
      message: empty ? `${contextPath} is empty — AI has no architectural context` : undefined,
    };
  }));

  // M9: ai.constraints is array of strings
  results.push(rule('m9', 'ai.constraints is array of strings', 'warning', 'high', () => {
    const constraints = manifest.ai?.constraints;
    if (!constraints) {
      return { passed: false, message: 'ai.constraints is missing — no generation guardrails defined' };
    }
    if (!Array.isArray(constraints)) {
      return { passed: false, message: `ai.constraints must be an array, got ${typeof constraints}` };
    }
    const nonStrings = constraints.filter(c => typeof c !== 'string');
    if (nonStrings.length > 0) {
      return { passed: false, message: 'ai.constraints must be an array of strings' };
    }
    if (constraints.length === 0) {
      return { passed: false, message: 'ai.constraints is empty — add at least one generation guardrail' };
    }
    return { passed: true };
  }));

  return {
    suite: 'M',
    label: 'MANIFEST',
    results,
    durationMs: Math.round(performance.now() - start),
  };
}
