// src/suites/c-suite.ts
// C — Contract Suite
// Validates module.contract.ts files using ts-morph AST parsing.
// Checks defineContract() shape, function exports, invariant coverage, dependency integrity.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { Project, SyntaxKind, Node } from 'ts-morph';
import type { RuleResult, SuiteResult, AetherManifest } from '../types.js';

type RuleFn = () => { passed: boolean; message?: string; location?: string; hint?: string };

function rule(
  id: string,
  name: string,
  severity: 'critical' | 'warning' | 'info',
  aiImpact: 'high' | 'medium' | 'low',
  fn: RuleFn,
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

// ─── Contract extraction helpers ────────────────────────────────────────────

interface ContractData {
  name?: string;
  description?: string;
  routes?: Array<{ method?: string; path?: string; auth?: boolean }>;
  functions?: string[];
  types?: string[];
  sideEffects?: string[];
  invariants?: string[];
  dependencies?: { modules?: string[] };
}

/**
 * Extracts the argument object from `defineContract({...})` by traversing the AST.
 * Returns a plain JS object with the extracted values.
 */
function extractContractData(contractPath: string): ContractData | null {
  const project = new Project({ addFilesFromTsConfig: false, skipFileDependencyResolution: true });
  const sf = project.addSourceFileAtPath(contractPath);

  // Find: export default defineContract({...})
  const exportDefault = sf.getExportedDeclarations().get('default')?.[0];
  if (!exportDefault) return null;

  // Navigate to the CallExpression
  let callExpr = exportDefault.isKind(SyntaxKind.CallExpression)
    ? exportDefault
    : exportDefault.getFirstDescendantByKind(SyntaxKind.CallExpression);

  if (!callExpr) return null;

  // Check it's defineContract
  const expr = callExpr.getExpression();
  if (expr.getText() !== 'defineContract') return null;

  const arg = callExpr.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return null;

  const result: ContractData = {};

  for (const prop of arg.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const key = prop.getName();
    const val = prop.getInitializer();
    if (!val) continue;

    if (key === 'name' || key === 'description') {
      if (Node.isStringLiteral(val)) result[key] = val.getLiteralValue();
    }

    if (key === 'invariants' || key === 'sideEffects') {
      if (Node.isArrayLiteralExpression(val)) {
        result[key] = val.getElements()
          .filter(Node.isStringLiteral)
          .map(e => e.getLiteralValue());
      }
    }

    if (key === 'exposes' && Node.isObjectLiteralExpression(val)) {
      for (const ep of val.getProperties()) {
        if (!Node.isPropertyAssignment(ep)) continue;
        const ek = ep.getName();
        const ev = ep.getInitializer();
        if (!ev) continue;

        if (ek === 'functions' || ek === 'types') {
          if (Node.isArrayLiteralExpression(ev)) {
            result[ek] = ev.getElements()
              .filter(Node.isStringLiteral)
              .map(e => e.getLiteralValue());
          }
        }

        if (ek === 'routes' && Node.isArrayLiteralExpression(ev)) {
          result.routes = ev.getElements()
            .filter(Node.isObjectLiteralExpression)
            .map(routeObj => {
              const r: { method?: string; path?: string; auth?: boolean } = {};
              for (const rp of routeObj.getProperties()) {
                if (!Node.isPropertyAssignment(rp)) continue;
                const rk = rp.getName();
                const rv = rp.getInitializer();
                if (!rv) continue;
                if ((rk === 'method' || rk === 'path') && Node.isStringLiteral(rv)) {
                  r[rk] = rv.getLiteralValue();
                }
                if (rk === 'auth') {
                  r.auth = rv.getText() === 'true';
                }
              }
              return r;
            });
        }
      }
    }

    if (key === 'dependencies' && Node.isObjectLiteralExpression(val)) {
      result.dependencies = {};
      for (const dp of val.getProperties()) {
        if (!Node.isPropertyAssignment(dp)) continue;
        if (dp.getName() === 'modules') {
          const dv = dp.getInitializer();
          if (dv && Node.isArrayLiteralExpression(dv)) {
            result.dependencies.modules = dv.getElements()
              .filter(Node.isStringLiteral)
              .map(e => e.getLiteralValue());
          }
        }
      }
    }
  }

  return result;
}

// ─── Cycle detection ────────────────────────────────────────────────────────

function detectCycles(
  modules: Array<{ name: string; path: string }>,
  cwd: string,
): string[] {
  // Build adjacency map
  const deps = new Map<string, string[]>();
  for (const mod of modules) {
    const contractPath = join(cwd, mod.path.replace(/^\//, ''), 'module.contract.ts');
    if (!existsSync(contractPath)) {
      deps.set(mod.name, []);
      continue;
    }
    try {
      const data = extractContractData(contractPath);
      deps.set(mod.name, data?.dependencies?.modules ?? []);
    } catch {
      deps.set(mod.name, []);
    }
  }

  // DFS cycle detection (Tarjan-lite)
  const cycles: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).join(' → ') + ' → ' + node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const neighbor of deps.get(node) ?? []) {
      if (dfs(neighbor)) break;
    }
    path.pop();
    stack.delete(node);
    return false;
  }

  for (const mod of modules) dfs(mod.name);
  return cycles;
}

// ─── Suite runner ────────────────────────────────────────────────────────────

export function runContractSuite(
  cwd: string,
  manifest: AetherManifest,
  targetModule?: string,
): SuiteResult {
  const start = performance.now();
  const results: RuleResult[] = [];

  // Which modules to check
  const modules = targetModule
    ? manifest.modules.filter(m => m.name === targetModule)
    : manifest.modules;

  // We run rules per-module, but report as a flat list with location context
  for (const mod of modules) {
    const contractPath = join(cwd, mod.path.replace(/^\//, ''), 'module.contract.ts');
    const contractRel = `modules/${mod.name}/module.contract.ts`;

    if (!existsSync(contractPath)) {
      // If missing, add a single critical failure and skip remaining rules
      results.push({
        id: 'c0', name: 'module.contract.ts readable',
        passed: false, severity: 'critical', aiImpact: 'high', durationMs: 0,
        location: contractRel, message: `module.contract.ts not found for module "${mod.name}"`,
      });
      continue;
    }

    let data: ContractData | null = null;
    try { data = extractContractData(contractPath); } catch (_) { data = null; }

    const moduleLabel = modules.length > 1 ? '' : ` [${mod.name}]`;

    // C1: defineContract() is called as default export
    results.push(rule(`c1${moduleLabel}`, 'defineContract() is called as default export', 'critical', 'high', () => {
      if (!data) {
        return { passed: false, location: contractRel, message: `Could not parse ${contractRel} — defineContract() may be missing or malformed` };
      }
      return { passed: true };
    }));

    // C2: description field is ≥ 30 chars
    results.push(rule(`c2${moduleLabel}`, 'description field is ≥ 30 chars', 'critical', 'high', () => {
      const desc = data?.description;
      const valid = typeof desc === 'string' && desc.trim().length >= 30;
      return {
        passed: valid,
        location: valid ? undefined : contractRel,
        message: !valid ? `description is ${typeof desc === 'string' ? desc.trim().length : 0} chars (minimum: 30)` : undefined,
      };
    }));

    // C3: every route has method, path, auth
    results.push(rule(`c3${moduleLabel}`, 'exposes.routes entries have method, path, auth', 'critical', 'high', () => {
      const routes = data?.routes ?? [];
      const bad = routes.filter(r => !r.method || !r.path || r.auth === undefined);
      return {
        passed: bad.length === 0,
        location: bad.length > 0 ? contractRel : undefined,
        message: bad.length > 0
          ? `${bad.length} route(s) missing auth field: ${bad.map(r => `{ method: "${r.method}", path: "${r.path}" }`).join(', ')}`
          : undefined,
        hint: bad.length > 0 ? 'AI impact: HIGH — generated handler will skip auth check' : undefined,
      };
    }));

    // C4: exposes.functions names match actual exports in index.ts
    results.push(rule(`c4${moduleLabel}`, 'exposes.functions names match actual exports', 'critical', 'medium', () => {
      const declaredFns = data?.functions ?? [];
      if (declaredFns.length === 0) return { passed: true };

      const indexPath = join(cwd, mod.path.replace(/^\//, ''), 'index.ts');
      if (!existsSync(indexPath)) {
        return {
          passed: false,
          location: contractRel,
          message: `No index.ts found in module "${mod.name}" — cannot verify exposes.functions`,
          hint: 'Create an index.ts that re-exports all declared functions',
        };
      }

      const indexContent = readFileSync(indexPath, 'utf-8');
      const missing = declaredFns.filter(fn => {
        // Check for export keyword + the function name
        return !new RegExp(`\\bexport\\b[^;]*\\b${fn}\\b`).test(indexContent);
      });

      return {
        passed: missing.length === 0,
        location: missing.length > 0 ? contractRel : undefined,
        message: missing.length > 0
          ? `Declared in exposes.functions but not exported: ${missing.map(f => `"${f}"`).join(', ')}`
          : undefined,
        hint: missing.length > 0 ? 'AI impact: HIGH — AI will call functions that do not exist' : undefined,
      };
    }));

    // C5: invariants array is non-empty
    results.push(rule(`c5${moduleLabel}`, 'invariants array is non-empty', 'critical', 'high', () => {
      const invariants = data?.invariants;
      const valid = Array.isArray(invariants) && invariants.length > 0;
      return {
        passed: valid,
        location: valid ? undefined : contractRel,
        message: !valid ? `Module "${mod.name}" has no invariants — AI has no domain rules to respect` : undefined,
      };
    }));

    // C6: each invariant has a named test in *.invariants.test.ts
    results.push(rule(`c6${moduleLabel}`, 'each invariant has a generated test', 'critical', 'high', () => {
      const invariants = data?.invariants ?? [];
      if (invariants.length === 0) return { passed: true }; // C5 already flagged this

      const modDir = join(cwd, mod.path.replace(/^\//, ''));
      const testFiles = readdirSync(modDir)
        .filter(f => f.endsWith('.invariants.test.ts'))
        .map(f => readFileSync(join(modDir, f), 'utf-8'));

      if (testFiles.length === 0) {
        return {
          passed: false,
          location: contractRel,
          message: `No *.invariants.test.ts found in ${mod.path}`,
          hint: 'Create a test file with it() calls matching each invariant string',
        };
      }

      const combinedTestContent = testFiles.join('\n');
      const missing = invariants.filter(inv => {
        // Check for substring of the invariant in an it() call
        const normalized = inv.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        // Match: it('...invariant...') or it("...invariant...")
        const itRegex = /it\([`'"](.*?)[`'"]/g;
        const testNames = [...combinedTestContent.matchAll(itRegex)].map(m =>
          m[1].toLowerCase().replace(/[^a-z0-9 ]/g, '')
        );
        return !testNames.some(t => t.includes(normalized.slice(0, 20)));
      });

      return {
        passed: missing.length === 0,
        location: missing.length > 0 ? contractRel : undefined,
        message: missing.length > 0
          ? `Invariants without matching tests: ${missing.map(i => `"${i}"`).join(', ')}`
          : undefined,
      };
    }));

    // C7: sideEffects declared (warning if empty)
    results.push(rule(`c7${moduleLabel}`, 'sideEffects declared for all DB writes', 'warning', 'medium', () => {
      const se = data?.sideEffects;
      const hasDbWrite = (se ?? []).some(s => s.includes('writes to'));
      // We can't truly verify "all DB writes" without running the code,
      // so we check: if the module has routes that likely write (POST/PUT/DELETE), sideEffects should be non-empty
      const routes = data?.routes ?? [];
      const writingRoutes = routes.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method ?? ''));
      const missingSideEffects = writingRoutes.length > 0 && (!Array.isArray(se) || se.length === 0);
      return {
        passed: !missingSideEffects,
        location: missingSideEffects ? contractRel : undefined,
        message: missingSideEffects
          ? `Module has writing routes but sideEffects is empty`
          : undefined,
      };
    }));

    // C8: all dependencies.modules are registered modules
    results.push(rule(`c8${moduleLabel}`, 'all declared dependencies are registered modules', 'critical', 'medium', () => {
      const declaredDeps = data?.dependencies?.modules ?? [];
      const registeredNames = manifest.modules.map(m => m.name);
      const unknown = declaredDeps.filter(d => !registeredNames.includes(d));
      return {
        passed: unknown.length === 0,
        location: unknown.length > 0 ? contractRel : undefined,
        message: unknown.length > 0
          ? `Unregistered dependencies: ${unknown.map(d => `"${d}"`).join(', ')}`
          : undefined,
        hint: unknown.length > 0 ? 'Add missing modules to project.manifest or remove the dependency' : undefined,
      };
    }));
  }

  // C9: no circular module dependencies (run once across all modules)
  if (!targetModule || modules.length > 0) {
    results.push(rule('c9', 'no circular module dependencies', 'critical', 'medium', () => {
      const cycles = detectCycles(manifest.modules, cwd);
      return {
        passed: cycles.length === 0,
        message: cycles.length > 0 ? `Cycle detected: ${cycles.join(' | ')}` : undefined,
        hint: cycles.length > 0 ? 'AI impact: MEDIUM — async call order will be undefined' : undefined,
      };
    }));
  }

  return {
    suite: 'C',
    label: 'CONTRACT',
    module: targetModule,
    results,
    durationMs: Math.round(performance.now() - start),
  };
}
