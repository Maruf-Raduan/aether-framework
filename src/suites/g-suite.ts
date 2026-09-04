// src/suites/g-suite.ts
// G — Generation Suite
// Validates generated .ts files in module routes/ directories.
// Uses ts-morph for import analysis and TypeScript diagnostics.

import { existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively collects all .ts files in a directory.
 * Skips *.test.ts, *.spec.ts, and *.d.ts files.
 */
function collectTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(full);
    }
  }
  return files;
}

// Known direct DB driver packages — if any of these are imported outside /lib/db.ts, it's a G1 violation
const DB_DRIVER_PACKAGES = [
  'pg', 'pg-pool', 'mysql', 'mysql2', 'better-sqlite3', 'sqlite3',
  '@neondatabase/serverless', 'postgres', 'drizzle-orm', '@prisma/client',
  'knex', 'typeorm', 'sequelize',
];

/**
 * Parse import specifiers from a source file using ts-morph.
 */
function getImportSpecifiers(project: Project, filePath: string): string[] {
  const sf = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
  return sf.getImportDeclarations().map(d => d.getModuleSpecifierValue());
}

/**
 * Extracts contract route data for a module to check G2.
 */
interface RouteSpec { method: string; path: string; auth: boolean }

function getContractRoutes(cwd: string, modPath: string): RouteSpec[] {
  const contractPath = join(cwd, modPath.replace(/^\//, ''), 'module.contract.ts');
  if (!existsSync(contractPath)) return [];

  try {
    const project = new Project({ addFilesFromTsConfig: false, skipFileDependencyResolution: true });
    const sf = project.addSourceFileAtPath(contractPath);
    const exportDefault = sf.getExportedDeclarations().get('default')?.[0];
    if (!exportDefault) return [];

    const callExpr = exportDefault.isKind(SyntaxKind.CallExpression)
      ? exportDefault
      : exportDefault.getFirstDescendantByKind(SyntaxKind.CallExpression);
    if (!callExpr) return [];

    const arg = callExpr.getArguments()[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) return [];

    const exposesProp = arg.getProperties()
      .find(p => Node.isPropertyAssignment(p) && p.getName() === 'exposes');
    if (!exposesProp || !Node.isPropertyAssignment(exposesProp)) return [];

    const exposesVal = exposesProp.getInitializer();
    if (!exposesVal || !Node.isObjectLiteralExpression(exposesVal)) return [];

    const routesProp = exposesVal.getProperties()
      .find(p => Node.isPropertyAssignment(p) && p.getName() === 'routes');
    if (!routesProp || !Node.isPropertyAssignment(routesProp)) return [];

    const routesVal = routesProp.getInitializer();
    if (!routesVal || !Node.isArrayLiteralExpression(routesVal)) return [];

    return routesVal.getElements()
      .filter(Node.isObjectLiteralExpression)
      .map(routeObj => {
        const r: RouteSpec = { method: '', path: '', auth: false };
        for (const prop of routeObj.getProperties()) {
          if (!Node.isPropertyAssignment(prop)) continue;
          const k = prop.getName();
          const v = prop.getInitializer();
          if (!v) continue;
          if ((k === 'method' || k === 'path') && Node.isStringLiteral(v)) {
            r[k] = v.getLiteralValue();
          }
          if (k === 'auth') r.auth = v.getText() === 'true';
        }
        return r;
      });
  } catch {
    return [];
  }
}

// ─── Suite runner ─────────────────────────────────────────────────────────────

export function runGenerationSuite(
  cwd: string,
  manifest: AetherManifest,
  targetModule?: string,
  virtualFiles: import('../types.js').VirtualFile[] = []
): SuiteResult {
  const start = performance.now();
  const results: RuleResult[] = [];

  const modules = targetModule
    ? manifest.modules.filter(m => m.name === targetModule)
    : manifest.modules;

  // Collect all route files across target modules
  const allRouteFiles: string[] = [];
  for (const mod of modules) {
    const routesDir = join(cwd, mod.path.replace(/^\//, ''), 'routes');
    allRouteFiles.push(...collectTsFiles(routesDir));
    
    // Also include any virtual files that belong in this directory
    for (const vf of virtualFiles) {
      if (vf.path.startsWith(mod.path.replace(/^\//, '') + '/routes/') && vf.path.endsWith('.ts')) {
        const fullVfPath = join(cwd, vf.path);
        if (!allRouteFiles.includes(fullVfPath)) {
          allRouteFiles.push(fullVfPath);
        }
      }
    }
  }

  // Build ts-morph project over route files
  const project = new Project({ addFilesFromTsConfig: false, skipFileDependencyResolution: true });
  for (const f of allRouteFiles) {
    const relPath = relative(cwd, f).replace(/\\/g, '/');
    const vf = virtualFiles.find(v => v.path === relPath);
    if (vf) {
      project.createSourceFile(f, vf.content, { overwrite: true });
    } else {
      project.addSourceFileAtPath(f);
    }
  }

  // G1: No direct DB driver imports outside /lib/db.ts
  results.push(rule('g1', 'no direct DB imports outside /lib/db.ts', 'critical', 'high', () => {
    if (allRouteFiles.length === 0) return { passed: true };

    const dbConstraint = manifest.ai?.constraints?.some(c =>
      c.toLowerCase().includes('db access') || c.toLowerCase().includes('/lib/db')
    );

    if (!dbConstraint) {
      return { passed: true }; // Constraint not declared — rule not applicable
    }

    const violations: Array<{ file: string; pkg: string }> = [];
    for (const filePath of allRouteFiles) {
      const imports = getImportSpecifiers(project, filePath);
      for (const imp of imports) {
        if (DB_DRIVER_PACKAGES.includes(imp)) {
          violations.push({ file: relative(cwd, filePath).replace(/\\/g, '/'), pkg: imp });
        }
      }
    }

    return {
      passed: violations.length === 0,
      location: violations[0] ? violations[0].file : undefined,
      message: violations.length > 0
        ? violations.map(v => `${v.file}: import "${v.pkg}"  ← constraint violated`).join('\n        ')
        : undefined,
      hint: violations.length > 0 ? `Constraint: "DB access only via /lib/db.ts"` : undefined,
    };
  }));

  // G2: auth routes call requireUser()
  results.push(rule('g2', 'auth constraint respected on all generated routes', 'critical', 'high', () => {
    if (allRouteFiles.length === 0) return { passed: true };

    const violations: Array<{ file: string; route?: string }> = [];

    for (const mod of modules) {
      const routes = getContractRoutes(cwd, mod.path);
      const authRoutes = routes.filter(r => r.auth);
      if (authRoutes.length === 0) continue;

      const routesDir = join(cwd, mod.path.replace(/^\//, ''), 'routes');
      const routeFiles = collectTsFiles(routesDir);

      for (const filePath of routeFiles) {
        const sf = project.getSourceFile(filePath);
        if (!sf) continue;
        const content = sf.getFullText();
        const relPath = relative(cwd, filePath).replace(/\\/g, '/');

        // Simple heuristic: the file exports a handler and does NOT call requireUser
        const hasHandler = /\bexport\b/.test(content);
        const hasRequireUser = /requireUser\s*\(/.test(content);

        if (hasHandler && !hasRequireUser) {
          violations.push({ file: relPath });
        }
      }
    }

    return {
      passed: violations.length === 0,
      location: violations[0]?.file,
      message: violations.length > 0
        ? violations.map(v => `${v.file} — no requireUser() call found`).join('\n        ')
        : undefined,
      hint: violations.length > 0 ? 'requireUser() must be the first statement in auth:true handlers' : undefined,
    };
  }));

  // G3: no undeclared module cross-imports
  results.push(rule('g3', 'no undeclared module cross-imports', 'critical', 'medium', () => {
    if (allRouteFiles.length === 0) return { passed: true };

    const violations: Array<{ file: string; imp: string }> = [];
    const registeredModules = manifest.modules.map(m => m.name);

    for (const filePath of allRouteFiles) {
      const sf = project.getSourceFile(filePath);
      if (!sf) continue;
      const relPath = relative(cwd, filePath).replace(/\\/g, '/');

      // Determine which module this file belongs to
      const ownerModule = modules.find(m =>
        relPath.startsWith(m.path.replace(/^\//, ''))
      );

      const imports = getImportSpecifiers(project, filePath);
      for (const imp of imports) {
        // Check for internal module imports like /modules/tasks/lib/...
        const internalModulePattern = /^[./]*modules\/([^/]+)\//;
        const match = internalModulePattern.exec(imp);
        if (!match) continue;

        const targetMod = match[1];
        if (targetMod === ownerModule?.name) continue; // Own module is fine
        if (!registeredModules.includes(targetMod)) continue; // Not a known module

        // Check if the import goes deeper than index.ts (internal import)
        const afterModulePath = imp.replace(/^.*modules\/[^/]+\//, '');
        if (afterModulePath && afterModulePath !== 'index') {
          violations.push({ file: relPath, imp });
        }
      }
    }

    return {
      passed: violations.length === 0,
      location: violations[0]?.file,
      message: violations.length > 0
        ? violations.map(v => `${v.file}: "${v.imp}"  ← internal module import`).join('\n        ')
        : undefined,
      hint: violations.length > 0 ? 'Import only from the module index, not internal paths' : undefined,
    };
  }));

  // G4: invariant tests pass (SKIPPED in Session 1 — no test runner)
  results.push({
    id: 'g4',
    name: 'all invariant tests pass after generation',
    passed: true,
    skipped: true,
    severity: 'info',
    aiImpact: 'high',
    durationMs: 0,
    message: 'Deferred: test runner integration is Session 2',
  });

  // G5: TypeScript compiles with zero errors
  results.push(rule('g5', 'type check passes with zero errors', 'critical', 'medium', () => {
    if (allRouteFiles.length === 0) return { passed: true };

    const diagProject = new Project({
      tsConfigFilePath: join(cwd, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      compilerOptions: {
        noEmit: true,
        skipLibCheck: true,
        noImplicitAny: false,
        rootDir: cwd,
      },
    });

    for (const f of allRouteFiles) {
      const relPath = relative(cwd, f).replace(/\\/g, '/');
      const vf = virtualFiles.find(v => v.path === relPath);
      if (vf) {
        diagProject.createSourceFile(f, vf.content, { overwrite: true });
      } else {
        diagProject.addSourceFileAtPath(f);
      }
    }

    const diagnostics = diagProject.getPreEmitDiagnostics();
    const errors = diagnostics.filter(d => d.getCategory() === 1 /* Error */);

    if (errors.length === 0) return { passed: true };

    const firstErr = errors[0];
    const file = firstErr.getSourceFile();
    const relPath = file ? relative(cwd, file.getFilePath()).replace(/\\/g, '/') : 'unknown';
    const line = file && firstErr.getLineNumber() ? `${relPath}:${firstErr.getLineNumber()}` : relPath;

    const msgObj = firstErr.getMessageText();
    const msg = typeof msgObj === 'string' ? msgObj : msgObj.getMessageText();

    return {
      passed: false,
      location: line,
      message: `${errors.length} TypeScript error(s). First: ${msg}`,
    };
  }));

  return {
    suite: 'G',
    label: 'GENERATION',
    module: targetModule,
    results,
    durationMs: Math.round(performance.now() - start),
  };
}
