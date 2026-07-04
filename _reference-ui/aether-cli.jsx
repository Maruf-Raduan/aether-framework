import { useState, useEffect, useRef } from "react";

// ─── SCENARIO DATA ────────────────────────────────────────────────────────────

const SCENARIOS = {
  clean: {
    label: "aether check",
    desc: "Full conformance check — all passing",
    cmd: "aether check",
    steps: [
      { ms: 120, line: "◈  Aether Conformance v0.1.0", color: "#60a5fa" },
      { ms: 80,  line: "   Running on: my-app  (./project.manifest)", color: "#3d5570" },
      { ms: 300, line: "" },
      { ms: 0,   line: "── M  MANIFEST ────────────────────────────────", color: "#60a5fa" },
      { ms: 140, line: "   ✓  manifest exists at project root                     0ms", color: "#34d399" },
      { ms: 110, line: "   ✓  required top-level fields present                   1ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  aether version is semver                            0ms", color: "#34d399" },
      { ms: 100, line: "   ✓  intent field is non-empty string ≥ 20 chars         0ms", color: "#34d399" },
      { ms: 160, line: "   ✓  each module path exists on disk                     3ms", color: "#34d399" },
      { ms: 130, line: "   ✓  each module has a module.contract.ts                2ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  no duplicate module names                           0ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  ai.context file exists and is non-empty             1ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  ai.constraints is array of strings                  0ms", color: "#34d399" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── C  CONTRACT ─────────────────────────────────", color: "#34d399" },
      { ms: 110, line: "   ✓  defineContract() is called as default export        1ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  description field is ≥ 30 chars                     0ms", color: "#34d399" },
      { ms: 120, line: "   ✓  exposes.routes entries have method, path, auth      2ms", color: "#34d399" },
      { ms: 200, line: "   ✓  exposes.functions names match actual exports        8ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  invariants array is non-empty                       0ms", color: "#34d399" },
      { ms: 340, line: "   ✓  each invariant has a generated test                14ms", color: "#34d399" },
      { ms: 150, line: "   ✓  sideEffects declared for all DB writes              4ms", color: "#34d399" },
      { ms: 120, line: "   ✓  all declared dependencies are registered modules    2ms", color: "#34d399" },
      { ms: 180, line: "   ✓  no circular module dependencies                     6ms", color: "#34d399" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── A  AI CONTEXT ───────────────────────────────", color: "#f472b6" },
      { ms: 90,  line: "   ✓  contains ## Architecture decisions section          1ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  contains ## Key files section                       0ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  contains ## Things AI commonly gets wrong section   1ms", color: "#34d399" },
      { ms: 120, line: "   ✓  all /lib/ paths in context exist on disk            3ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  word count ≥ 200                                    0ms", color: "#34d399" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── G  GENERATION ───────────────────────────────", color: "#fbbf24" },
      { ms: 130, line: "   ✓  no direct DB imports outside /lib/db.ts             5ms", color: "#34d399" },
      { ms: 160, line: "   ✓  auth constraint respected on all generated routes   7ms", color: "#34d399" },
      { ms: 140, line: "   ✓  no undeclared module cross-imports                  4ms", color: "#34d399" },
      { ms: 420, line: "   ✓  all invariant tests pass after generation          18ms", color: "#34d399" },
      { ms: 290, line: "   ✓  type check passes with zero errors                12ms", color: "#34d399" },
      { ms: 350, line: "" },
      { ms: 0,   line: "─────────────────────────────────────────────────", color: "#1a2a38" },
      { ms: 0,   line: "  26 passed  ·  0 failed  ·  0 warnings  ·  118ms", color: "#34d399" },
      { ms: 0,   line: "" },
      { ms: 0,   line: "  ◈ AI CONTEXT SCORE   ████████████████████  100 / 100", color: "#60a5fa" },
      { ms: 0,   line: "    Fully conformant. AI generation will have maximum context.", color: "#3d5570" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  ✓ Conformance passed.", color: "#34d399" },
    ],
    exit: { code: 0, color: "#34d399" },
  },

  failing: {
    label: "aether check  (failures)",
    desc: "Real failures — auth missing, circular dep, phantom function",
    cmd: "aether check",
    steps: [
      { ms: 120, line: "◈  Aether Conformance v0.1.0", color: "#60a5fa" },
      { ms: 80,  line: "   Running on: my-app  (./project.manifest)", color: "#3d5570" },
      { ms: 300, line: "" },
      { ms: 0,   line: "── M  MANIFEST ────────────────────────────────", color: "#60a5fa" },
      { ms: 140, line: "   ✓  manifest exists at project root                     0ms", color: "#34d399" },
      { ms: 110, line: "   ✓  required top-level fields present                   1ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  aether version is semver                            0ms", color: "#34d399" },
      { ms: 100, line: "   ✓  intent field is non-empty string ≥ 20 chars         0ms", color: "#34d399" },
      { ms: 160, line: "   ✓  each module path exists on disk                     3ms", color: "#34d399" },
      { ms: 130, line: "   ✓  each module has a module.contract.ts                2ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  no duplicate module names                           0ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  ai.context file exists and is non-empty             1ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  ai.constraints is array of strings                  0ms", color: "#34d399" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── C  CONTRACT ─────────────────────────────────", color: "#34d399" },
      { ms: 110, line: "   ✓  defineContract() is called as default export        1ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  description field is ≥ 30 chars                     0ms", color: "#34d399" },
      { ms: 180, line: "   ✗  exposes.routes entries have method, path, auth             [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → modules/tasks/module.contract.ts:28", color: "#f87171" },
      { ms: 0,   line: "        { method: \"POST\", path: \"/tasks\" }  ← auth missing", color: "#f87171" },
      { ms: 0,   line: "        AI impact: HIGH — generated handler will skip auth check", color: "#9b3535" },
      { ms: 160, line: "   ✗  exposes.functions names match actual exports        8ms  [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → modules/tasks/module.contract.ts", color: "#f87171" },
      { ms: 0,   line: "        Declared: \"archiveTask\"  — not found in module exports", color: "#f87171" },
      { ms: 0,   line: "        AI impact: HIGH — AI will call a function that doesn't exist", color: "#9b3535" },
      { ms: 80,  line: "   ✓  invariants array is non-empty                       0ms", color: "#34d399" },
      { ms: 340, line: "   ✓  each invariant has a generated test                14ms", color: "#34d399" },
      { ms: 150, line: "   ✓  sideEffects declared for all DB writes              4ms", color: "#34d399" },
      { ms: 120, line: "   ✓  all declared dependencies are registered modules    2ms", color: "#34d399" },
      { ms: 280, line: "   ✗  no circular module dependencies                     9ms  [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → Cycle detected:", color: "#f87171" },
      { ms: 0,   line: "        teams → tasks → teams", color: "#f87171" },
      { ms: 0,   line: "        AI impact: MEDIUM — async call order will be undefined", color: "#9b3535" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── A  AI CONTEXT ───────────────────────────────", color: "#f472b6" },
      { ms: 90,  line: "   ✓  contains ## Architecture decisions section          1ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  contains ## Key files section                       0ms", color: "#34d399" },
      { ms: 120, line: "   ✗  contains ## Things AI commonly gets wrong section        [warn]", color: "#fbbf24" },
      { ms: 0,   line: "      → Section missing from ai-context.md", color: "#fbbf24" },
      { ms: 0,   line: "        AI impact: HIGH — recurring generation mistakes won't be prevented", color: "#7a5a10" },
      { ms: 160, line: "   ✓  all /lib/ paths in context exist on disk            3ms", color: "#34d399" },
      { ms: 90,  line: "   ✗  word count ≥ 200                                         [warn]", color: "#fbbf24" },
      { ms: 0,   line: "      → ai-context.md: 61 words  (minimum: 200)", color: "#fbbf24" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── G  GENERATION ───────────────────────────────", color: "#fbbf24" },
      { ms: 200, line: "   ✗  no direct DB imports outside /lib/db.ts             5ms  [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → modules/tasks/routes/create.ts:3", color: "#f87171" },
      { ms: 0,   line: "        import { Pool } from \"pg\"  ← constraint violated", color: "#f87171" },
      { ms: 0,   line: "        Constraint: \"DB access only via /lib/db.ts\"", color: "#9b3535" },
      { ms: 160, line: "   ✓  auth constraint respected on all generated routes   7ms", color: "#34d399" },
      { ms: 140, line: "   ✓  no undeclared module cross-imports                  4ms", color: "#34d399" },
      { ms: 420, line: "   ✓  all invariant tests pass after generation          18ms", color: "#34d399" },
      { ms: 310, line: "   ✗  type check passes with zero errors                14ms  [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → modules/tasks/routes/assign.ts:14", color: "#f87171" },
      { ms: 0,   line: "        TS2345: Argument of type 'string' is not assignable", color: "#f87171" },
      { ms: 0,   line: "        to parameter of type 'UserId'", color: "#f87171" },
      { ms: 350, line: "" },
      { ms: 0,   line: "─────────────────────────────────────────────────", color: "#1a2a38" },
      { ms: 0,   line: "  19 passed  ·  5 failed  ·  2 warnings  ·  134ms", color: "#f87171" },
      { ms: 0,   line: "" },
      { ms: 0,   line: "  ◈ AI CONTEXT SCORE   ████████░░░░░░░░░░░░   42 / 100", color: "#fbbf24" },
      { ms: 0,   line: "    Critical contract issues will corrupt AI code generation.", color: "#7a3535" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  ✗ Conformance failed. Fix 5 critical issues before running aether gen.", color: "#f87171" },
    ],
    exit: { code: 1, color: "#f87171" },
  },

  module: {
    label: "aether check --module tasks",
    desc: "Scope check to a single module",
    cmd: "aether check --module tasks",
    steps: [
      { ms: 100, line: "◈  Aether Conformance v0.1.0", color: "#60a5fa" },
      { ms: 80,  line: "   Scope: module tasks  (./modules/tasks)", color: "#3d5570" },
      { ms: 300, line: "" },
      { ms: 0,   line: "── C  CONTRACT  [tasks] ────────────────────────", color: "#34d399" },
      { ms: 110, line: "   ✓  defineContract() is called as default export        1ms", color: "#34d399" },
      { ms: 90,  line: "   ✓  description field is ≥ 30 chars                     0ms", color: "#34d399" },
      { ms: 120, line: "   ✓  exposes.routes entries have method, path, auth      2ms", color: "#34d399" },
      { ms: 200, line: "   ✓  exposes.functions names match actual exports        8ms", color: "#34d399" },
      { ms: 80,  line: "   ✓  invariants array is non-empty                       0ms", color: "#34d399" },
      { ms: 340, line: "   ✓  each invariant has a generated test                14ms", color: "#34d399" },
      { ms: 150, line: "   ✓  sideEffects declared for all DB writes              4ms", color: "#34d399" },
      { ms: 120, line: "   ✓  all declared dependencies are registered modules    2ms", color: "#34d399" },
      { ms: 180, line: "   ✓  no circular module dependencies                     6ms", color: "#34d399" },
      { ms: 250, line: "" },
      { ms: 0,   line: "── G  GENERATION  [tasks] ──────────────────────", color: "#fbbf24" },
      { ms: 130, line: "   ✓  no direct DB imports outside /lib/db.ts             5ms", color: "#34d399" },
      { ms: 160, line: "   ✓  auth constraint respected on all generated routes   7ms", color: "#34d399" },
      { ms: 140, line: "   ✓  no undeclared module cross-imports                  4ms", color: "#34d399" },
      { ms: 420, line: "   ✓  all invariant tests pass after generation          18ms", color: "#34d399" },
      { ms: 290, line: "   ✓  type check passes with zero errors                12ms", color: "#34d399" },
      { ms: 300, line: "" },
      { ms: 0,   line: "─────────────────────────────────────────────────", color: "#1a2a38" },
      { ms: 0,   line: "  14 passed  ·  0 failed  ·  0 warnings  ·  83ms", color: "#34d399" },
      { ms: 0,   line: "" },
      { ms: 0,   line: "  ◈ AI CONTEXT SCORE   ████████████████████  100 / 100", color: "#60a5fa" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  ✓ Module [tasks] conformance passed.", color: "#34d399" },
    ],
    exit: { code: 0, color: "#34d399" },
  },

  watch: {
    label: "aether check --watch",
    desc: "Watch mode — re-runs on file change",
    cmd: "aether check --watch",
    steps: [
      { ms: 100, line: "◈  Aether Conformance v0.1.0  [watch mode]", color: "#60a5fa" },
      { ms: 80,  line: "   Watching: project.manifest, **/module.contract.ts,", color: "#3d5570" },
      { ms: 0,   line: "             ai-context.md, **/routes/**", color: "#3d5570" },
      { ms: 400, line: "" },
      { ms: 0,   line: "   Running initial check...", color: "#3d5570" },
      { ms: 500, line: "   ✓ 26 passed · 0 failed · 118ms", color: "#34d399" },
      { ms: 0,   line: "   ◈ Watching for changes. Press q to quit.", color: "#2a4050" },
      { ms: 1200,line: "" },
      { ms: 0,   line: "   ~ modules/tasks/module.contract.ts  [saved]", color: "#fbbf24" },
      { ms: 300, line: "   Re-running affected suites: CONTRACT, GENERATION", color: "#3d5570" },
      { ms: 700, line: "   ✗ 1 failed in 47ms", color: "#f87171" },
      { ms: 0,   line: "" },
      { ms: 0,   line: "   ✗  exposes.routes entries have method, path, auth  [CRITICAL]", color: "#f87171" },
      { ms: 0,   line: "      → module.contract.ts:28", color: "#f87171" },
      { ms: 0,   line: "        { method: \"DELETE\", path: \"/tasks/:id\" }  ← auth missing", color: "#f87171" },
      { ms: 0,   line: "        AI impact: HIGH", color: "#9b3535" },
      { ms: 1400,line: "" },
      { ms: 0,   line: "   ~ modules/tasks/module.contract.ts  [saved]", color: "#fbbf24" },
      { ms: 300, line: "   Re-running affected suites: CONTRACT, GENERATION", color: "#3d5570" },
      { ms: 700, line: "   ✓ 14 passed · 0 failed · 51ms", color: "#34d399" },
      { ms: 0,   line: "   ◈ All clear. Watching for changes.", color: "#2a4050" },
    ],
    exit: null,
  },

  score: {
    label: "aether check --score",
    desc: "AI context score breakdown only",
    cmd: "aether check --score",
    steps: [
      { ms: 100, line: "◈  Aether Conformance v0.1.0  [score mode]", color: "#60a5fa" },
      { ms: 300, line: "" },
      { ms: 0,   line: "  AI CONTEXT SCORE BREAKDOWN", color: "#60a5fa" },
      { ms: 0,   line: "  ───────────────────────────────────────────", color: "#1a2a38" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  Manifest Quality            25 / 25", color: "#34d399" },
      { ms: 0,   line: "  ├ intent length              ████████████  10 / 10", color: "#34d399" },
      { ms: 0,   line: "  ├ constraints count (≥3)     ████████████   8 /  8", color: "#34d399" },
      { ms: 0,   line: "  └ preferred patterns (≥3)   ████████████   7 /  7", color: "#34d399" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  Contract Completeness        35 / 35", color: "#34d399" },
      { ms: 0,   line: "  ├ description richness       ████████████  10 / 10", color: "#34d399" },
      { ms: 0,   line: "  ├ invariants count (≥2)      ████████████  10 / 10", color: "#34d399" },
      { ms: 0,   line: "  ├ sideEffects declared       ████████████   8 /  8", color: "#34d399" },
      { ms: 0,   line: "  └ all functions verified     ████████████   7 /  7", color: "#34d399" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  AI Context Doc               25 / 25", color: "#34d399" },
      { ms: 0,   line: "  ├ arch decisions present     ████████████  10 / 10", color: "#34d399" },
      { ms: 0,   line: "  ├ key files section          ████████████   8 /  8", color: "#34d399" },
      { ms: 0,   line: "  └ word count (847 words)     ████████████   7 /  7", color: "#34d399" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  Generation Integrity         15 / 15", color: "#34d399" },
      { ms: 0,   line: "  ├ constraint violations: 0   ████████████   8 /  8", color: "#34d399" },
      { ms: 0,   line: "  └ type errors: 0             ████████████   7 /  7", color: "#34d399" },
      { ms: 200, line: "" },
      { ms: 0,   line: "  ───────────────────────────────────────────", color: "#1a2a38" },
      { ms: 0,   line: "  TOTAL   ████████████████████  100 / 100", color: "#60a5fa" },
      { ms: 0,   line: "" },
      { ms: 0,   line: "  Interpretation:", color: "#3d5570" },
      { ms: 0,   line: "   90-100  Excellent — AI will generate idiomatic code", color: "#34d399" },
      { ms: 0,   line: "   70- 89  Good — minor context gaps, occasional mismatches", color: "#60a5fa" },
      { ms: 0,   line: "   50- 69  Fair — AI will need manual correction cycles", color: "#fbbf24" },
      { ms: 0,   line: "    0- 49  Poor — high risk of constraint violations", color: "#f87171" },
    ],
    exit: { code: 0, color: "#34d399" },
  },
};

// ─── CLI SPEC PANELS ──────────────────────────────────────────────────────────

const CLI_SPEC = [
  {
    id: "commands",
    label: "Commands",
    items: [
      { cmd: "aether check", desc: "Run the full conformance suite against the current project." },
      { cmd: "aether check --module <name>", desc: "Scope the check to a single module's contract and generation tests." },
      { cmd: "aether check --suite <M|C|A|G>", desc: "Run only one suite. M=Manifest, C=Contract, A=AI Context, G=Generation." },
      { cmd: "aether check --watch", desc: "Watch mode. Re-runs affected suites on every file save. Debounced 200ms." },
      { cmd: "aether check --score", desc: "Print only the AI Context Score breakdown — no test details." },
      { cmd: "aether check --fix", desc: "(Experimental) Attempt to auto-fix non-critical warnings where possible." },
      { cmd: "aether check --ci", desc: "CI mode. No color, no progress. Exits 0 on pass, 1 on any failure." },
      { cmd: "aether check --json", desc: "Output full results as JSON to stdout. Useful for editor integrations." },
    ],
  },
  {
    id: "flags",
    label: "Flags",
    items: [
      { cmd: "--module <name>", desc: "Restrict to a single registered module." },
      { cmd: "--suite <id>", desc: "Run a single suite: M, C, A, or G." },
      { cmd: "--watch, -w", desc: "Watch mode with smart re-run scoping." },
      { cmd: "--score", desc: "Show AI Context Score breakdown only." },
      { cmd: "--fix", desc: "Auto-fix safe warnings (experimental)." },
      { cmd: "--ci", desc: "Machine-readable output, no TTY formatting." },
      { cmd: "--json", desc: "Full results as JSON to stdout." },
      { cmd: "--fail-on warn", desc: "Treat warnings as failures. Useful for strict CI pipelines." },
      { cmd: "--quiet, -q", desc: "Show only failures and the summary line." },
      { cmd: "--verbose, -v", desc: "Show all test IDs, timing, and full error context." },
    ],
  },
  {
    id: "exit",
    label: "Exit Codes",
    items: [
      { cmd: "0", desc: "All tests passed. No critical failures." },
      { cmd: "1", desc: "One or more critical tests failed." },
      { cmd: "2", desc: "Configuration error — manifest not found or malformed." },
      { cmd: "3", desc: "Internal runner error." },
    ],
  },
  {
    id: "integration",
    label: "Integration",
    items: [
      { cmd: "pre-commit hook", desc: 'Run aether check --suite M,C before every commit. Add to .husky/pre-commit.' },
      { cmd: "CI pipeline", desc: 'aether check --ci exits 1 on failure, integrates with GitHub Actions, GitLab CI.' },
      { cmd: "aether gen hook", desc: 'aether gen always runs aether check --suite C,G after generation. Cannot be skipped.' },
      { cmd: "VS Code extension", desc: 'Inline squiggles for contract violations. Reads from aether check --json --watch.' },
      { cmd: "IDE context injection", desc: 'Editor extension injects manifest + relevant contracts into AI prompts automatically.' },
    ],
  },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Terminal({ scenario, running, lines, done, onRun }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div style={{
      background: "#030608",
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid #0e1a26",
      boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
      fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
    }}>
      {/* Title bar */}
      <div style={{
        background: "#0a1018",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderBottom: "1px solid #0e1a26",
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        <span style={{ flex: 1, textAlign: "center", color: "#1e3040", fontSize: "11px", letterSpacing: "1px" }}>
          my-app — bash
        </span>
      </div>

      {/* Terminal body */}
      <div style={{ padding: "20px 24px", minHeight: "380px", maxHeight: "480px", overflowY: "auto" }}>
        {/* Prompt + command */}
        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#34d399", fontSize: "13px" }}>❯</span>
          <span style={{ color: "#60a5fa", fontSize: "13px" }}>{scenario.cmd}</span>
          {!running && !done && (
            <button onClick={onRun} style={{
              marginLeft: "12px",
              background: "#0e1a26",
              border: "1px solid #1a3040",
              borderRadius: "4px",
              color: "#34d399",
              fontSize: "11px",
              padding: "2px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.5px",
            }}>
              ↵ run
            </button>
          )}
        </div>

        {/* Output lines */}
        {lines.map((line, i) => (
          <div key={i} style={{
            fontSize: "12px",
            lineHeight: "1.75",
            color: line.color || "#4a6070",
            whiteSpace: "pre",
          }}>
            {line.line}
          </div>
        ))}

        {/* Cursor */}
        {running && (
          <span style={{
            display: "inline-block",
            width: 8, height: 14,
            background: "#60a5fa",
            marginLeft: 2,
            animation: "blink 1s step-end infinite",
          }} />
        )}

        {/* Exit code */}
        {done && scenario.exit && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#34d399", fontSize: "13px" }}>❯</span>
            <span style={{ color: "#1e3040", fontSize: "12px" }}>
              exit code: <span style={{ color: scenario.exit.color }}>{scenario.exit.code}</span>
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function SpecPanel({ section }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {section.items.map((item, i) => (
          <div key={i} style={{
            background: "#070d14",
            border: "1px solid #0e1a26",
            borderRadius: "6px",
            padding: "12px 16px",
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
          }}>
            <code style={{
              color: "#60a5fa",
              fontSize: "12px",
              background: "rgba(96,165,250,0.07)",
              border: "1px solid rgba(96,165,250,0.15)",
              borderRadius: "4px",
              padding: "2px 8px",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}>{item.cmd}</code>
            <span style={{ color: "#3d5570", fontSize: "12px", lineHeight: 1.7 }}>{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeScenario, setActiveScenario] = useState("clean");
  const [activeSpec, setActiveSpec] = useState("commands");
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState("demo"); // "demo" | "spec"
  const timeoutsRef = useRef([]);

  const scenario = SCENARIOS[activeScenario];

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const switchScenario = (id) => {
    clearTimeouts();
    setActiveScenario(id);
    setLines([]);
    setRunning(false);
    setDone(false);
  };

  const runScenario = () => {
    clearTimeouts();
    setLines([]);
    setRunning(true);
    setDone(false);

    let delay = 0;
    scenario.steps.forEach((step, i) => {
      delay += step.ms;
      const t = setTimeout(() => {
        setLines(prev => [...prev, { line: step.line, color: step.color }]);
        if (i === scenario.steps.length - 1) {
          setRunning(false);
          setDone(true);
        }
      }, delay);
      timeoutsRef.current.push(t);
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#040810",
      color: "#c9d1d9",
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0e1a26",
        padding: "20px 36px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        background: "#030608",
      }}>
        <div>
          <span style={{ color: "#60a5fa", fontSize: "15px", fontWeight: 700, letterSpacing: "1px" }}>◈ aether</span>
          <span style={{ color: "#1e3040", fontSize: "13px", marginLeft: "10px" }}>/ cli runner</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          {["demo", "spec"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? "rgba(96,165,250,0.1)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(96,165,250,0.3)" : "#0e1a26"}`,
              borderRadius: "5px",
              color: tab === t ? "#60a5fa" : "#1e3040",
              padding: "5px 14px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 36px", maxWidth: "900px", margin: "0 auto" }}>

        {tab === "demo" && (
          <>
            {/* Scenario picker */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ color: "#1a3040", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>
                Scenarios
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {Object.entries(SCENARIOS).map(([id, s]) => (
                  <button key={id} onClick={() => switchScenario(id)} style={{
                    background: activeScenario === id ? "rgba(96,165,250,0.1)" : "#070d14",
                    border: `1px solid ${activeScenario === id ? "rgba(96,165,250,0.4)" : "#0e1a26"}`,
                    borderRadius: "6px",
                    color: activeScenario === id ? "#60a5fa" : "#2a4050",
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}>
                    <div style={{ color: activeScenario === id ? "#60a5fa" : "#2a4050", marginBottom: "2px" }}>
                      $ {s.label}
                    </div>
                    <div style={{ color: "#1a3040", fontSize: "10px" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal */}
            <Terminal
              scenario={scenario}
              running={running}
              lines={lines}
              done={done}
              onRun={runScenario}
            />

            {done && (
              <div style={{ marginTop: "12px", textAlign: "right" }}>
                <button onClick={runScenario} style={{
                  background: "transparent",
                  border: "1px solid #0e1a26",
                  borderRadius: "4px",
                  color: "#1e3040",
                  fontSize: "11px",
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                  ↺ run again
                </button>
              </div>
            )}
          </>
        )}

        {tab === "spec" && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>
                CLI Specification
              </h2>
              <p style={{ margin: 0, color: "#1e3040", fontSize: "12px" }}>
                Full command reference for <code style={{ color: "#60a5fa" }}>aether check</code>
              </p>
            </div>

            {/* Spec tabs */}
            <div style={{ display: "flex", gap: "2px", marginBottom: "16px", borderBottom: "1px solid #0e1a26", paddingBottom: "0" }}>
              {CLI_SPEC.map(s => (
                <button key={s.id} onClick={() => setActiveSpec(s.id)} style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeSpec === s.id ? "#60a5fa" : "transparent"}`,
                  color: activeSpec === s.id ? "#60a5fa" : "#1e3040",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  letterSpacing: "0.5px",
                  transition: "all 0.15s",
                  marginBottom: "-1px",
                }}>
                  {s.label}
                </button>
              ))}
            </div>

            <SpecPanel section={CLI_SPEC.find(s => s.id === activeSpec)} />

            {/* Integration note */}
            {activeSpec === "integration" && (
              <div style={{
                marginTop: "20px",
                background: "rgba(96,165,250,0.05)",
                border: "1px solid rgba(96,165,250,0.15)",
                borderRadius: "8px",
                padding: "16px 20px",
              }}>
                <div style={{ color: "#60a5fa", fontSize: "11px", marginBottom: "8px", letterSpacing: "1px" }}>
                  KEY DESIGN PRINCIPLE
                </div>
                <p style={{ margin: 0, color: "#2a4050", fontSize: "12px", lineHeight: 1.8 }}>
                  <code style={{ color: "#60a5fa" }}>aether gen</code> always runs{" "}
                  <code style={{ color: "#60a5fa" }}>aether check --suite C,G</code> after generation.
                  This is not optional and cannot be skipped — it ensures that AI-generated code
                  is always validated against the module contract before the developer sees it.
                  The self-healing loop uses the check output as its error input.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
