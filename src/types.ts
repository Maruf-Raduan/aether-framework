// src/types.ts
// Shared types for the Aether conformance engine.
// This is also the schema for --json output.

export type Suite = 'M' | 'C' | 'A' | 'G';
export type Severity = 'critical' | 'warning' | 'info';
export type AiImpact = 'high' | 'medium' | 'low';

export interface RuleResult {
  id: string;           // e.g. "m1", "c3", "g1"
  name: string;         // human-readable rule name
  passed: boolean;
  skipped?: boolean;    // true when rule is deferred (e.g. g4 in Session 1)
  severity: Severity;
  aiImpact: AiImpact;
  durationMs: number;
  location?: string;    // "file.ts:line" — present on failure
  message?: string;     // human-readable error detail
  hint?: string;        // secondary context line (e.g. constraint text)
}

export interface SuiteResult {
  suite: Suite;
  label: string;        // "MANIFEST" | "CONTRACT" | "AI CONTEXT" | "GENERATION"
  module?: string;      // present when scoped to a specific module
  results: RuleResult[];
  durationMs: number;
}

export interface ScoreBreakdown {
  manifestQuality:       { score: number; max: number };
  contractCompleteness:  { score: number; max: number };
  aiContextDoc:          { score: number; max: number };
  generationIntegrity:   { score: number; max: number };
  total:                 number; // 0-100
}

export interface CheckReport {
  timestamp: string;
  projectName: string;
  module?: string;       // set when --module flag is used
  suites: SuiteResult[];
  score: ScoreBreakdown;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  totalMs: number;
  exitCode: 0 | 1 | 2 | 3;
}

// Manifest shape (runtime-validated)
export interface AetherManifest {
  name: string;
  version: string;
  aether: string;
  intent: string;
  stack: {
    runtime: string;
    language: string;
    rendering?: string;
    database?: string;
  };
  patterns: {
    routing?: string;
    dataFetching?: string;
    errorHandling?: string;
    [key: string]: string | undefined;
  };
  ai: {
    context: string;
    constraints?: string[];
  };
  modules: Array<{
    name: string;
    path: string;
  }>;
}

export interface CheckOptions {
  module?: string;
  suites?: Suite[];
  json: boolean;
  ci: boolean;
  scoreOnly: boolean;
  cwd: string;
}

export interface VirtualFile {
  path: string;     // Must be a relative path from workspace root, e.g. "modules/tasks/routes/delete.ts"
  content: string;
}
