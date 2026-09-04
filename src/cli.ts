#!/usr/bin/env bun
// src/cli.ts
// Aether CLI entry point.
// Usage: aether check [--module <name>] [--suite <M|C|A|G>] [--json] [--ci] [--score]

import { resolve } from 'path';
import { loadManifest } from './manifest.js';
import { runManifestSuite } from './suites/m-suite.js';
import { runContractSuite } from './suites/c-suite.js';
import { runAiContextSuite } from './suites/a-suite.js';
import { runGenerationSuite } from './suites/g-suite.js';
import { computeScore } from './score.js';
import { renderReport } from './renderer.js';
import type { Suite, SuiteResult, CheckReport, CheckOptions } from './types.js';

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): CheckOptions {
  const args = argv.slice(2); // strip 'bun' and 'src/cli.ts'
  const opts: CheckOptions = {
    json: false,
    ci: false,
    scoreOnly: false,
    cwd: process.cwd(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--module':
      case '-m':
        opts.module = args[++i];
        break;
      case '--suite':
      case '-s': {
        const raw = args[++i] ?? '';
        opts.suites = raw.split(',').map(s => s.trim().toUpperCase()) as Suite[];
        break;
      }
      case '--json':
        opts.json = true;
        break;
      case '--ci':
        opts.ci = true;
        opts.json = false; // --ci overrides --json for exit code purposes
        break;
      case '--score':
        opts.scoreOnly = true;
        break;
      case '--cwd':
        opts.cwd = resolve(args[++i] ?? process.cwd());
        break;
      // Unrecognised flags are silently ignored (forward compatibility)
    }
  }

  return opts;
}

async function main(): Promise<void> {
  const isGenCmd = process.argv.includes('gen');
  let targetType = "route";
  let targetDesc = "";

  if (isGenCmd) {
    const genIdx = process.argv.indexOf('gen');
    targetType = process.argv[genIdx + 1];
    targetDesc = process.argv.slice(genIdx + 2).join(' ');
  }

  const opts = parseArgs(process.argv);

  // ── Load manifest ──────────────────────────────────────────────────────────
  const manifestResult = loadManifest(opts.cwd);
  if (!manifestResult.ok) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: manifestResult.error, exitCode: manifestResult.code }) + '\n');
    } else {
      process.stderr.write(`\n\x1b[38;2;248;113;113m✗  ${manifestResult.error}\x1b[0m\n\n`);
    }
    process.exit(manifestResult.code);
  }

  const { manifest } = manifestResult;

  if (isGenCmd) {
    const { runGenCommand } = await import('./gen.js');
    await runGenCommand(opts.cwd, manifest, targetType, targetDesc);
    return;
  }

  // Validate module filter
  if (opts.module) {
    const knownModules = manifest.modules.map(m => m.name);
    if (!knownModules.includes(opts.module)) {
      const msg = `Module "${opts.module}" is not registered in project.manifest. Known: ${knownModules.join(', ')}`;
      if (opts.json) {
        process.stdout.write(JSON.stringify({ error: msg, exitCode: 2 }) + '\n');
      } else {
        process.stderr.write(`\n\x1b[38;2;248;113;113m✗  ${msg}\x1b[0m\n\n`);
      }
      process.exit(2);
    }
  }

  // ── Determine which suites to run ──────────────────────────────────────────
  const requestedSuites: Suite[] = opts.suites?.length ? opts.suites : ['M', 'C', 'A', 'G'];

  // When --module is set, skip M and A suites (they're project-wide)
  const suitesToRun: Suite[] = opts.module
    ? requestedSuites.filter(s => s === 'C' || s === 'G')
    : requestedSuites;

  const wallStart = performance.now();
  const suiteResults: SuiteResult[] = [];

  for (const suite of suitesToRun) {
    switch (suite) {
      case 'M':
        suiteResults.push(runManifestSuite(opts.cwd, manifest));
        break;
      case 'C':
        suiteResults.push(runContractSuite(opts.cwd, manifest, opts.module));
        break;
      case 'A':
        suiteResults.push(runAiContextSuite(opts.cwd, manifest));
        break;
      case 'G':
        suiteResults.push(runGenerationSuite(opts.cwd, manifest, opts.module));
        break;
    }
  }

  // ── Aggregate counts ───────────────────────────────────────────────────────
  const allResults = suiteResults.flatMap(s => s.results);
  const passed    = allResults.filter(r => r.passed && !r.skipped).length;
  const failed    = allResults.filter(r => !r.passed && !r.skipped && r.severity === 'critical').length;
  const warnings  = allResults.filter(r => !r.passed && !r.skipped && r.severity === 'warning').length;
  const skipped   = allResults.filter(r => r.skipped).length;

  const score = computeScore(suiteResults);
  const totalMs = Math.round(performance.now() - wallStart);

  // ── Build report ───────────────────────────────────────────────────────────
  const exitCode: 0 | 1 | 2 | 3 = failed > 0 ? 1 : 0;

  const report: CheckReport = {
    timestamp: new Date().toISOString(),
    projectName: manifest.name,
    module: opts.module,
    suites: suiteResults,
    score,
    passed,
    failed,
    warnings,
    skipped,
    totalMs,
    exitCode,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  renderReport(report, {
    json: opts.json,
    ci: opts.ci,
    scoreOnly: opts.scoreOnly,
  });

  process.exit(exitCode);
}

main().catch(err => {
  process.stderr.write(`\nInternal runner error: ${String(err)}\n`);
  process.exit(3);
});
