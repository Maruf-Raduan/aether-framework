// src/score.ts
// Computes the AI Context Score (0–100) from suite results.
// Breakdown: Manifest Quality /25, Contract Completeness /35, AI Context Doc /25, Generation Integrity /15

import type { SuiteResult, ScoreBreakdown, RuleResult } from './types.js';

function findRule(suites: SuiteResult[], suiteId: string, ruleId: string): RuleResult | undefined {
  const suite = suites.find(s => s.suite === suiteId);
  if (!suite) return undefined;
  return suite.results.find(r => r.id.startsWith(ruleId));
}

function passed(suites: SuiteResult[], suiteId: string, ruleId: string): boolean {
  return findRule(suites, suiteId, ruleId)?.passed ?? false;
}

export function computeScore(suites: SuiteResult[]): ScoreBreakdown {
  // ── Manifest Quality (25 pts) ─────────────────────────────────────────────
  // intent length (10 pts): full credit if ≥ 20 chars
  // constraints count (8 pts): full credit if ≥ 3 constraints
  // preferred patterns (7 pts): full credit if patterns object has ≥ 1 entry

  let manifestScore = 0;
  if (passed(suites, 'M', 'm4')) manifestScore += 10; // intent ≥ 20 chars
  if (passed(suites, 'M', 'm9')) manifestScore += 8;  // constraints is array
  if (passed(suites, 'M', 'm2')) manifestScore += 7;  // top-level fields (incl. patterns)

  // ── Contract Completeness (35 pts) ────────────────────────────────────────
  // description richness (10): ≥ 30 chars
  // invariants count (10): non-empty
  // sideEffects (8): declared
  // functions verified (7): all declared fns exported

  let contractScore = 0;
  if (passed(suites, 'C', 'c2')) contractScore += 10; // description ≥ 30 chars
  if (passed(suites, 'C', 'c5')) contractScore += 10; // invariants non-empty
  if (passed(suites, 'C', 'c7')) contractScore += 8;  // sideEffects
  if (passed(suites, 'C', 'c4')) contractScore += 7;  // functions match exports

  // ── AI Context Doc (25 pts) ───────────────────────────────────────────────
  // arch decisions present (10)
  // key files section (8)
  // word count (7): ≥ 200

  let contextScore = 0;
  if (passed(suites, 'A', 'a1')) contextScore += 10; // architecture decisions section
  if (passed(suites, 'A', 'a2')) contextScore += 8;  // key files section
  if (passed(suites, 'A', 'a5')) contextScore += 7;  // word count ≥ 200

  // ── Generation Integrity (15 pts) ─────────────────────────────────────────
  // constraint violations: 0 (8)
  // type errors: 0 (7)

  let generationScore = 0;
  if (passed(suites, 'G', 'g1')) generationScore += 8; // no DB imports
  if (passed(suites, 'G', 'g5')) generationScore += 7; // zero TS errors

  const total = manifestScore + contractScore + contextScore + generationScore;

  return {
    manifestQuality:      { score: manifestScore,  max: 25 },
    contractCompleteness: { score: contractScore,   max: 35 },
    aiContextDoc:         { score: contextScore,    max: 25 },
    generationIntegrity:  { score: generationScore, max: 15 },
    total,
  };
}

export function scoreInterpretation(score: number): string {
  if (score >= 90) return 'Excellent. AI will generate idiomatic, constraint-respecting code with high reliability.';
  if (score >= 70) return 'Good. Minor context gaps may cause occasional pattern mismatches.';
  if (score >= 50) return 'Fair. AI will require frequent manual correction cycles.';
  return 'Poor. High risk of security issues, invariant violations, and wrong patterns.';
}

export function scoreBar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
