import { useState, useRef, useEffect } from "react";

// ─── SCENARIO DATA ────────────────────────────────────────────────────────────

const SCENARIOS = {
  route: {
    label: "aether gen route",
    cmd: 'aether gen route "POST /tasks/:id/assign"',
    desc: "Generate a route handler — succeeds first attempt",
    phases: [
      {
        id: "context",
        label: "Context Loading",
        color: "#60a5fa",
        steps: [
          { ms: 100, line: "◈  Aether Gen v0.1.0", color: "#60a5fa" },
          { ms: 80,  line: '   Target: route  "POST /tasks/:id/assign"', color: "#3d5570" },
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 1  CONTEXT LOADING ─────────────────────", color: "#60a5fa" },
          { ms: 200, line: "   ◈  Reading project.manifest...            done  2ms", color: "#3d5570" },
          { ms: 180, line: "   ◈  Reading ai-context.md...               done  1ms", color: "#3d5570" },
          { ms: 220, line: "   ◈  Reading modules/tasks/module.contract.ts...  3ms", color: "#3d5570" },
          { ms: 160, line: "   ◈  Reading modules/auth/module.contract.ts...   2ms", color: "#3d5570" },
          { ms: 140, line: "   ◈  Scanning existing routes/...           done  4ms", color: "#3d5570" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Context assembled:", color: "#1e3040" },
          { ms: 0,   line: "   ├ intent:       Task management SaaS for small teams", color: "#1e3040" },
          { ms: 0,   line: "   ├ constraints:  3 hard rules loaded", color: "#1e3040" },
          { ms: 0,   line: "   ├ patterns:     loader-pattern, result-type, css-modules", color: "#1e3040" },
          { ms: 0,   line: "   ├ contract:     tasks module — 4 routes, 6 functions, 3 invariants", color: "#1e3040" },
          { ms: 0,   line: "   └ existing:     4 route files scanned for style consistency", color: "#1e3040" },
        ],
      },
      {
        id: "generation",
        label: "AI Generation",
        color: "#a78bfa",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 2  AI GENERATION ───────────────────────", color: "#a78bfa" },
          { ms: 160, line: "   ◈  Building prompt (2,847 tokens)...", color: "#3d5570" },
          { ms: 80,  line: "      ├ system:    aether-gen-system-v1", color: "#1e3040" },
          { ms: 0,   line: "      ├ manifest:  injected", color: "#1e3040" },
          { ms: 0,   line: "      ├ contract:  tasks + auth injected", color: "#1e3040" },
          { ms: 0,   line: "      ├ context:   ai-context.md injected", color: "#1e3040" },
          { ms: 0,   line: "      └ examples:  3 existing routes injected for style", color: "#1e3040" },
          { ms: 400, line: "" },
          { ms: 0,   line: "   ◈  Calling claude-sonnet-4...", color: "#a78bfa" },
          { ms: 1800,line: "   ◈  Streaming response...               done  1.4s", color: "#a78bfa" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Generated files:", color: "#1e3040" },
          { ms: 0,   line: "   ├ modules/tasks/routes/assign.ts         (84 lines)", color: "#34d399" },
          { ms: 0,   line: "   └ modules/tasks/routes/assign.test.ts    (47 lines)", color: "#34d399" },
        ],
      },
      {
        id: "validation",
        label: "Validation",
        color: "#fbbf24",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 3  CONFORMANCE CHECK ───────────────────", color: "#fbbf24" },
          { ms: 180, line: "   ↺  Running aether check --suite C,G...", color: "#3d5570" },
          { ms: 300, line: "   ✓  exposes.routes auth constraint satisfied        3ms", color: "#34d399" },
          { ms: 200, line: "   ✓  no direct DB imports outside /lib/db.ts         4ms", color: "#34d399" },
          { ms: 240, line: "   ✓  no undeclared module cross-imports              2ms", color: "#34d399" },
          { ms: 380, line: "   ✓  type check passes with zero errors             11ms", color: "#34d399" },
          { ms: 420, line: "   ✓  all invariant tests pass                       17ms", color: "#34d399" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   ✓  Conformance passed on attempt 1 / 3", color: "#34d399" },
        ],
      },
      {
        id: "done",
        label: "Done",
        color: "#34d399",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── RESULT ───────────────────────────────────────", color: "#1a2a38" },
          { ms: 0,   line: "   ✓  modules/tasks/routes/assign.ts", color: "#34d399" },
          { ms: 0,   line: "   ✓  modules/tasks/routes/assign.test.ts", color: "#34d399" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Total:  1 generation  ·  1 attempt  ·  2.1s", color: "#3d5570" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "◈  Done. Review your files before committing.", color: "#60a5fa" },
        ],
      },
    ],
  },

  healed: {
    label: "aether gen route  (self-healing)",
    cmd: 'aether gen route "DELETE /tasks/:id"',
    desc: "Fails type check on attempt 1, heals on attempt 2",
    phases: [
      {
        id: "context",
        label: "Context Loading",
        color: "#60a5fa",
        steps: [
          { ms: 100, line: "◈  Aether Gen v0.1.0", color: "#60a5fa" },
          { ms: 80,  line: '   Target: route  "DELETE /tasks/:id"', color: "#3d5570" },
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 1  CONTEXT LOADING ─────────────────────", color: "#60a5fa" },
          { ms: 200, line: "   ◈  Reading project.manifest...            done  2ms", color: "#3d5570" },
          { ms: 180, line: "   ◈  Reading ai-context.md...               done  1ms", color: "#3d5570" },
          { ms: 220, line: "   ◈  Reading modules/tasks/module.contract.ts...  3ms", color: "#3d5570" },
          { ms: 200, line: "   ◈  Scanning existing routes/...           done  4ms", color: "#3d5570" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Context assembled:  2,914 tokens", color: "#1e3040" },
        ],
      },
      {
        id: "attempt1",
        label: "Attempt 1",
        color: "#a78bfa",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 2  AI GENERATION  [attempt 1/3] ────────", color: "#a78bfa" },
          { ms: 160, line: "   ◈  Calling claude-sonnet-4...", color: "#a78bfa" },
          { ms: 1600,line: "   ◈  Streaming response...               done  1.3s", color: "#a78bfa" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Generated:", color: "#1e3040" },
          { ms: 0,   line: "   ├ modules/tasks/routes/delete.ts", color: "#3d5570" },
          { ms: 0,   line: "   └ modules/tasks/routes/delete.test.ts", color: "#3d5570" },
        ],
      },
      {
        id: "fail1",
        label: "Check → Fail",
        color: "#f87171",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 3  CONFORMANCE CHECK  [attempt 1] ──────", color: "#fbbf24" },
          { ms: 180, line: "   ↺  Running aether check --suite C,G...", color: "#3d5570" },
          { ms: 300, line: "   ✓  auth constraint satisfied                       3ms", color: "#34d399" },
          { ms: 200, line: "   ✓  no direct DB imports                            2ms", color: "#34d399" },
          { ms: 380, line: "   ✗  type check passes with zero errors             13ms", color: "#f87171" },
          { ms: 0,   line: "      → modules/tasks/routes/delete.ts:19", color: "#f87171" },
          { ms: 0,   line: "        TS2345: Argument of type 'string' is not", color: "#f87171" },
          { ms: 0,   line: "        assignable to parameter of type 'TaskId'", color: "#f87171" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   ✗  1 check failed. Entering self-heal loop.", color: "#f87171" },
        ],
      },
      {
        id: "heal",
        label: "Self-Heal",
        color: "#fbbf24",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 4  SELF-HEAL  [attempt 2/3] ────────────", color: "#fbbf24" },
          { ms: 160, line: "   ◈  Assembling error context...", color: "#3d5570" },
          { ms: 0,   line: "      ├ original prompt (2,914 tokens)", color: "#1e3040" },
          { ms: 0,   line: "      ├ generated file (84 lines)", color: "#1e3040" },
          { ms: 0,   line: "      ├ error:  TS2345 at delete.ts:19", color: "#1e3040" },
          { ms: 0,   line: "      └ hint:   TaskId is a branded type — see /types/index.ts", color: "#1e3040" },
          { ms: 300, line: "" },
          { ms: 0,   line: "   ◈  Calling claude-sonnet-4 [correction]...", color: "#fbbf24" },
          { ms: 1400,line: "   ◈  Streaming correction...             done  1.1s", color: "#fbbf24" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Patched:", color: "#1e3040" },
          { ms: 0,   line: "   └ modules/tasks/routes/delete.ts  (line 19 corrected)", color: "#fbbf24" },
        ],
      },
      {
        id: "pass2",
        label: "Check → Pass",
        color: "#34d399",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 5  CONFORMANCE CHECK  [attempt 2] ──────", color: "#fbbf24" },
          { ms: 180, line: "   ↺  Running aether check --suite C,G...", color: "#3d5570" },
          { ms: 280, line: "   ✓  auth constraint satisfied                       3ms", color: "#34d399" },
          { ms: 200, line: "   ✓  no direct DB imports                            2ms", color: "#34d399" },
          { ms: 360, line: "   ✓  type check passes with zero errors             10ms", color: "#34d399" },
          { ms: 400, line: "   ✓  all invariant tests pass                       16ms", color: "#34d399" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   ✓  Conformance passed on attempt 2 / 3", color: "#34d399" },
        ],
      },
      {
        id: "done",
        label: "Done",
        color: "#34d399",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── RESULT ───────────────────────────────────────", color: "#1a2a38" },
          { ms: 0,   line: "   ✓  modules/tasks/routes/delete.ts", color: "#34d399" },
          { ms: 0,   line: "   ✓  modules/tasks/routes/delete.test.ts", color: "#34d399" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Heal log:", color: "#1e3040" },
          { ms: 0,   line: "   └ attempt 1 → TS2345 TaskId type mismatch at line 19", color: "#3d5570" },
          { ms: 0,   line: "     attempt 2 → passed ✓", color: "#34d399" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Total:  2 attempts  ·  3.8s", color: "#3d5570" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "◈  Done. Review your files before committing.", color: "#60a5fa" },
        ],
      },
    ],
  },

  exhausted: {
    label: "aether gen route  (exhausted)",
    cmd: 'aether gen route "PATCH /tasks/:id/transfer-team"',
    desc: "All 3 attempts fail — outputs diagnostic report",
    phases: [
      {
        id: "context",
        label: "Context Loading",
        color: "#60a5fa",
        steps: [
          { ms: 100, line: "◈  Aether Gen v0.1.0", color: "#60a5fa" },
          { ms: 80,  line: '   Target: route  "PATCH /tasks/:id/transfer-team"', color: "#3d5570" },
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 1  CONTEXT LOADING ─────────────────────", color: "#60a5fa" },
          { ms: 200, line: "   ◈  Context assembled:  3,102 tokens", color: "#3d5570" },
          { ms: 0,   line: "   ⚠  Warning: route involves 2 modules (tasks, teams)", color: "#fbbf24" },
          { ms: 0,   line: "      Cross-module invariants will be validated strictly.", color: "#1e3040" },
        ],
      },
      {
        id: "attempt1",
        label: "Attempt 1 → Fail",
        color: "#f87171",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 2  AI GENERATION  [attempt 1/3] ────────", color: "#a78bfa" },
          { ms: 1400,line: "   ◈  Calling claude-sonnet-4...          done  1.2s", color: "#a78bfa" },
          { ms: 300, line: "   ↺  Conformance check...", color: "#3d5570" },
          { ms: 400, line: "   ✗  no undeclared module cross-imports", color: "#f87171" },
          { ms: 0,   line: "      → routes/transfer.ts:11", color: "#f87171" },
          { ms: 0,   line: "        import { getTeam } from '@modules/teams/lib/queries'", color: "#f87171" },
          { ms: 0,   line: "        Must use exposed function, not internal path", color: "#9b3535" },
        ],
      },
      {
        id: "attempt2",
        label: "Attempt 2 → Fail",
        color: "#f87171",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 3  SELF-HEAL  [attempt 2/3] ────────────", color: "#fbbf24" },
          { ms: 1200,line: "   ◈  Calling claude-sonnet-4 [correction]...  1.0s", color: "#fbbf24" },
          { ms: 300, line: "   ↺  Conformance check...", color: "#3d5570" },
          { ms: 350, line: "   ✗  task must belong to exactly one team  [INVARIANT]", color: "#f87171" },
          { ms: 0,   line: "      → routes/transfer.ts:34", color: "#f87171" },
          { ms: 0,   line: "        teamId set to null during transfer window", color: "#f87171" },
          { ms: 0,   line: "        Invariant: 'A task must always belong to exactly one team'", color: "#9b3535" },
        ],
      },
      {
        id: "attempt3",
        label: "Attempt 3 → Fail",
        color: "#f87171",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 4  SELF-HEAL  [attempt 3/3] ────────────", color: "#fbbf24" },
          { ms: 1100,line: "   ◈  Calling claude-sonnet-4 [correction]...  0.9s", color: "#fbbf24" },
          { ms: 300, line: "   ↺  Conformance check...", color: "#3d5570" },
          { ms: 350, line: "   ✗  task must belong to exactly one team  [INVARIANT]", color: "#f87171" },
          { ms: 0,   line: "      Same invariant violated — different line.", color: "#9b3535" },
          { ms: 0,   line: "      AI cannot resolve this within constraint budget.", color: "#9b3535" },
        ],
      },
      {
        id: "report",
        label: "Diagnostic",
        color: "#f87171",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── DIAGNOSTIC REPORT ────────────────────────────", color: "#f87171" },
          { ms: 0,   line: "   ✗  Generation exhausted (3/3 attempts failed)", color: "#f87171" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Root cause analysis:", color: "#3d5570" },
          { ms: 0,   line: "   The route requires a cross-module state transition", color: "#1e3040" },
          { ms: 0,   line: "   (task.teamId swap) that violates the invariant:", color: "#1e3040" },
          { ms: 0,   line: '   "A task must always belong to exactly one team"', color: "#fbbf24" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   AI assessment: This invariant may need revision", color: "#3d5570" },
          { ms: 0,   line: "   to allow atomic team transfers, OR the route logic", color: "#1e3040" },
          { ms: 0,   line: "   requires a saga/transaction pattern not yet defined.", color: "#1e3040" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Suggested actions:", color: "#3d5570" },
          { ms: 0,   line: "   1. aether invariant update tasks  — revise invariant", color: "#60a5fa" },
          { ms: 0,   line: "   2. aether gen saga transfer-task  — generate a saga", color: "#60a5fa" },
          { ms: 0,   line: "   3. Implement manually and run aether check after", color: "#60a5fa" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   Partial output saved to: .aether/gen-cache/transfer.ts", color: "#1e3040" },
          { ms: 0,   line: "   (not written to src — requires manual review)", color: "#1e3040" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "◈  Generation failed. No files written.", color: "#f87171" },
        ],
      },
    ],
  },

  module_cmd: {
    label: "aether gen module",
    cmd: 'aether gen module "notifications"',
    desc: "Scaffold a full new module from scratch",
    phases: [
      {
        id: "context",
        label: "Context Loading",
        color: "#60a5fa",
        steps: [
          { ms: 100, line: "◈  Aether Gen v0.1.0", color: "#60a5fa" },
          { ms: 80,  line: '   Target: module  "notifications"', color: "#3d5570" },
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 1  CONTEXT LOADING ─────────────────────", color: "#60a5fa" },
          { ms: 200, line: "   ◈  Reading project.manifest...            done  2ms", color: "#3d5570" },
          { ms: 180, line: "   ◈  Reading ai-context.md...               done  1ms", color: "#3d5570" },
          { ms: 160, line: "   ◈  Scanning all existing contracts...     done  8ms", color: "#3d5570" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   ◈  Interviewing for module intent...", color: "#60a5fa" },
          { ms: 0,   line: "" },
          { ms: 0,   line: '   ? What does "notifications" do? (plain English)', color: "#a78bfa" },
          { ms: 0,   line: '   > Sends in-app and email notifications when tasks are', color: "#3d5570" },
          { ms: 0,   line: '     assigned or completed. Users can set preferences.', color: "#3d5570" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "   ? Which modules does it depend on?  [detected: tasks, auth]", color: "#a78bfa" },
          { ms: 0,   line: "   > tasks, auth  ✓", color: "#3d5570" },
        ],
      },
      {
        id: "scaffold",
        label: "Scaffold Generation",
        color: "#a78bfa",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 2  SCAFFOLD GENERATION ─────────────────", color: "#a78bfa" },
          { ms: 160, line: "   ◈  Building scaffold prompt (3,210 tokens)...", color: "#3d5570" },
          { ms: 1800,line: "   ◈  Calling claude-sonnet-4...           done  1.6s", color: "#a78bfa" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   Scaffolded:", color: "#1e3040" },
          { ms: 0,   line: "   modules/notifications/", color: "#34d399" },
          { ms: 0,   line: "   ├ module.contract.ts          (contract)", color: "#34d399" },
          { ms: 0,   line: "   ├ index.ts                    (public API)", color: "#34d399" },
          { ms: 0,   line: "   ├ routes/", color: "#34d399" },
          { ms: 0,   line: "   │  ├ preferences.ts           (GET/PATCH /notifications/prefs)", color: "#34d399" },
          { ms: 0,   line: "   │  └ preferences.test.ts", color: "#34d399" },
          { ms: 0,   line: "   ├ lib/", color: "#34d399" },
          { ms: 0,   line: "   │  ├ send-email.ts            (email adapter)", color: "#34d399" },
          { ms: 0,   line: "   │  └ send-inapp.ts            (in-app adapter)", color: "#34d399" },
          { ms: 0,   line: "   └ notifications.invariants.test.ts", color: "#34d399" },
        ],
      },
      {
        id: "validation",
        label: "Validation",
        color: "#fbbf24",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 3  CONFORMANCE CHECK ───────────────────", color: "#fbbf24" },
          { ms: 400, line: "   ↺  Running aether check --suite C,G --module notifications", color: "#3d5570" },
          { ms: 300, line: "   ✓  defineContract() is called as default export        1ms", color: "#34d399" },
          { ms: 200, line: "   ✓  description field is ≥ 30 chars                     0ms", color: "#34d399" },
          { ms: 240, line: "   ✓  exposes.routes entries have method, path, auth      2ms", color: "#34d399" },
          { ms: 280, line: "   ✓  invariants array is non-empty                       0ms", color: "#34d399" },
          { ms: 340, line: "   ✓  each invariant has a generated test                12ms", color: "#34d399" },
          { ms: 200, line: "   ✓  no direct DB imports outside /lib/db.ts             4ms", color: "#34d399" },
          { ms: 380, line: "   ✓  type check passes with zero errors                14ms", color: "#34d399" },
          { ms: 200, line: "" },
          { ms: 0,   line: "   ✓  Conformance passed on attempt 1 / 3", color: "#34d399" },
        ],
      },
      {
        id: "manifest",
        label: "Manifest Update",
        color: "#34d399",
        steps: [
          { ms: 300, line: "" },
          { ms: 0,   line: "── PHASE 4  MANIFEST UPDATE ─────────────────────", color: "#34d399" },
          { ms: 160, line: "   ◈  Registering module in project.manifest...", color: "#3d5570" },
          { ms: 0,   line: '      + { "name": "notifications", "path": "/modules/notifications" }', color: "#34d399" },
          { ms: 200, line: "" },
          { ms: 0,   line: "── RESULT ───────────────────────────────────────", color: "#1a2a38" },
          { ms: 0,   line: "   ✓  7 files generated", color: "#34d399" },
          { ms: 0,   line: "   ✓  project.manifest updated", color: "#34d399" },
          { ms: 0,   line: "   ✓  1 attempt  ·  3.1s", color: "#34d399" },
          { ms: 0,   line: "" },
          { ms: 0,   line: "◈  Done. Module is conformant and registered.", color: "#60a5fa" },
        ],
      },
    ],
  },
};

// ─── GEN COMMANDS SPEC ───────────────────────────────────────────────────────

const GEN_COMMANDS = [
  {
    cmd: "aether gen route <description>",
    desc: "Generate a single route handler + test file. Description is natural language.",
    example: 'aether gen route "POST /tasks/:id/assign"',
  },
  {
    cmd: "aether gen module <name>",
    desc: "Scaffold a complete new module: contract, routes, lib, invariant tests, public API.",
    example: 'aether gen module "notifications"',
  },
  {
    cmd: "aether gen function <description>",
    desc: "Generate a single exported function inside the nearest module.",
    example: 'aether gen function "getOverdueTasksForUser in tasks"',
  },
  {
    cmd: "aether gen test <target>",
    desc: "Generate tests for an existing file — unit, integration, or invariant.",
    example: "aether gen test modules/tasks/routes/create.ts",
  },
  {
    cmd: "aether gen type <description>",
    desc: "Generate a TypeScript type or Zod schema, registered in /types/index.ts.",
    example: 'aether gen type "TaskPriority enum: low, medium, high, critical"',
  },
  {
    cmd: "aether gen saga <description>",
    desc: "Generate a multi-step cross-module transaction with rollback logic.",
    example: 'aether gen saga "transfer task between teams atomically"',
  },
];

const HEAL_SPEC = [
  { step: "1. Generate", detail: "Full context injected. AI produces implementation + test file." },
  { step: "2. Check", detail: "aether check --suite C,G runs automatically. Cannot be skipped." },
  { step: "3. Pass?", detail: "If all checks pass → files written to src, done." },
  { step: "4. Diagnose", detail: "Errors + original prompt + generated file assembled into correction context." },
  { step: "5. Hint inject", detail: "Aether adds targeted hints based on error type (type mismatch → branded types, invariant → contract text, import → module boundary rule)." },
  { step: "6. Correct", detail: "AI called again with correction context. Max 3 attempts total." },
  { step: "7. Exhausted?", detail: "If 3 attempts all fail → diagnostic report generated. No files written. Human takes over." },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function PhaseBar({ phases, currentPhase }) {
  return (
    <div style={{ display: "flex", gap: "0", marginBottom: "20px" }}>
      {phases.map((phase, i) => {
        const state = currentPhase === null ? "idle"
          : i < currentPhase ? "done"
          : i === currentPhase ? "active"
          : "pending";
        return (
          <div key={phase.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: "100%", height: "3px",
              background: state === "done" ? "#34d399"
                : state === "active" ? phase.color
                : "#0e1a26",
              transition: "background 0.3s",
            }} />
            <div style={{
              fontSize: "9px",
              color: state === "done" ? "#34d399"
                : state === "active" ? phase.color
                : "#1a2a38",
              marginTop: "5px",
              letterSpacing: "0.5px",
              fontFamily: "inherit",
              textAlign: "center",
              transition: "color 0.3s",
            }}>
              {state === "done" ? "✓ " : state === "active" ? "↺ " : ""}{phase.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Terminal({ scenario, running, lines, done, onRun, currentPhase }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const isExhausted = scenario.label.includes("exhausted") && done;
  const exitColor = isExhausted ? "#f87171"
    : scenario.label.includes("healing") ? "#34d399"
    : "#34d399";

  return (
    <div style={{
      background: "#030608",
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid #0e1a26",
      boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
      fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    }}>
      <div style={{
        background: "#080d14",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderBottom: "1px solid #0e1a26",
      }}>
        {["#ff5f57","#febc2e","#28c840"].map(c => (
          <span key={c} style={{ width:10,height:10,borderRadius:"50%",background:c,display:"inline-block" }} />
        ))}
        <span style={{ flex:1,textAlign:"center",color:"#1e3040",fontSize:"11px",letterSpacing:"1px" }}>
          my-app — bash
        </span>
      </div>

      <div style={{ padding: "20px 24px", minHeight: "400px", maxHeight: "500px", overflowY: "auto" }}>
        <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ color: "#34d399", fontSize: "13px" }}>❯</span>
          <span style={{ color: "#60a5fa", fontSize: "12px" }}>{scenario.cmd}</span>
          {!running && !done && (
            <button onClick={onRun} style={{
              marginLeft: "8px", background: "#0e1a26",
              border: "1px solid #1a3040", borderRadius: "4px",
              color: "#34d399", fontSize: "11px", padding: "2px 10px",
              cursor: "pointer", fontFamily: "inherit",
            }}>↵ run</button>
          )}
        </div>

        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: "12px", lineHeight: "1.75", color: l.color || "#4a6070", whiteSpace: "pre" }}>
            {l.line}
          </div>
        ))}

        {running && (
          <span style={{
            display:"inline-block",width:7,height:13,background:"#a78bfa",
            animation:"blink 1s step-end infinite",
          }} />
        )}

        {done && (
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#34d399", fontSize: "13px" }}>❯</span>
            <span style={{ color: "#1a2a38", fontSize: "12px" }}>
              exit <span style={{ color: exitColor }}>{isExhausted ? "1" : "0"}</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeScenario, setActiveScenario] = useState("route");
  const [tab, setTab] = useState("demo");
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const timeoutsRef = useRef([]);

  const scenario = SCENARIOS[activeScenario];

  const clearAll = () => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = []; };

  const switchScenario = (id) => {
    clearAll();
    setActiveScenario(id);
    setLines([]);
    setRunning(false);
    setDone(false);
    setCurrentPhase(null);
  };

  const runScenario = () => {
    clearAll();
    setLines([]);
    setRunning(true);
    setDone(false);
    setCurrentPhase(0);

    let delay = 0;
    let phaseIdx = 0;
    let stepCount = 0;
    const allSteps = [];

    scenario.phases.forEach((phase, pi) => {
      allSteps.push({ type: "phase", phaseIdx: pi });
      phase.steps.forEach(step => allSteps.push({ type: "step", step, phaseIdx: pi }));
    });

    allSteps.forEach((item, i) => {
      if (item.type === "phase") {
        const t = setTimeout(() => setCurrentPhase(item.phaseIdx), delay);
        timeoutsRef.current.push(t);
      } else {
        delay += item.step.ms;
        const t = setTimeout(() => {
          setLines(prev => [...prev, { line: item.step.line, color: item.step.color }]);
          if (i === allSteps.length - 1) {
            setRunning(false);
            setDone(true);
            setCurrentPhase(scenario.phases.length);
          }
        }, delay);
        timeoutsRef.current.push(t);
      }
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#040810",
      color: "#c9d1d9",
      fontFamily: "'IBM Plex Mono','Fira Code',monospace",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0e1a26",
        padding: "18px 36px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "#030608",
      }}>
        <div>
          <span style={{ color: "#a78bfa", fontSize: "15px", fontWeight: 700, letterSpacing: "1px" }}>◈ aether</span>
          <span style={{ color: "#1e3040", fontSize: "13px", marginLeft: "10px" }}>/ gen</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          {["demo","spec","heal"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? "rgba(167,139,250,0.1)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(167,139,250,0.35)" : "#0e1a26"}`,
              borderRadius: "5px",
              color: tab === t ? "#a78bfa" : "#1e3040",
              padding: "5px 14px", cursor: "pointer",
              fontSize: "11px", fontFamily: "inherit",
              letterSpacing: "1px", textTransform: "uppercase",
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "28px 36px", maxWidth: "920px", margin: "0 auto" }}>

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
                    background: activeScenario === id ? "rgba(167,139,250,0.08)" : "#070d14",
                    border: `1px solid ${activeScenario === id ? "rgba(167,139,250,0.4)" : "#0e1a26"}`,
                    borderRadius: "6px",
                    color: activeScenario === id ? "#a78bfa" : "#2a4050",
                    padding: "8px 14px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "11px",
                    transition: "all 0.15s", textAlign: "left",
                  }}>
                    <div style={{ marginBottom: "3px" }}>$ {s.label}</div>
                    <div style={{ color: "#1a3040", fontSize: "10px" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Phase bar */}
            <PhaseBar phases={scenario.phases} currentPhase={currentPhase} />

            {/* Terminal */}
            <Terminal
              scenario={scenario}
              running={running}
              lines={lines}
              done={done}
              onRun={runScenario}
              currentPhase={currentPhase}
            />

            {done && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button onClick={runScenario} style={{
                  background: "transparent", border: "1px solid #0e1a26",
                  borderRadius: "4px", color: "#1e3040",
                  fontSize: "11px", padding: "4px 12px",
                  cursor: "pointer", fontFamily: "inherit",
                }}>↺ run again</button>
              </div>
            )}
          </>
        )}

        {tab === "spec" && (
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>
              aether gen — Command Reference
            </h2>
            <p style={{ margin: "0 0 24px", color: "#1e3040", fontSize: "12px" }}>
              All generation targets. Every command runs conformance check after generation.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {GEN_COMMANDS.map(g => (
                <div key={g.cmd} style={{
                  background: "#070d14",
                  border: "1px solid #0e1a26",
                  borderRadius: "8px",
                  padding: "16px 20px",
                }}>
                  <code style={{
                    color: "#a78bfa", fontSize: "13px",
                    display: "block", marginBottom: "6px",
                  }}>{g.cmd}</code>
                  <p style={{ margin: "0 0 10px", color: "#3d5570", fontSize: "12px", lineHeight: 1.7 }}>
                    {g.desc}
                  </p>
                  <div style={{
                    background: "#030608",
                    border: "1px solid #0e1a26",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#1e3040",
                  }}>
                    <span style={{ color: "#34d399" }}>❯ </span>
                    <span style={{ color: "#60a5fa" }}>{g.example}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "heal" && (
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>
              Self-Healing Loop
            </h2>
            <p style={{ margin: "0 0 24px", color: "#1e3040", fontSize: "12px" }}>
              Every generation attempt that fails conformance automatically enters this loop.
            </p>

            {/* Loop diagram */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0", marginBottom: "32px" }}>
              {HEAL_SPEC.map((s, i) => (
                <div key={s.step} style={{ display: "flex", gap: "0", alignItems: "stretch" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "40px", flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: i === 6 ? "rgba(248,113,113,0.1)" : "rgba(167,139,250,0.1)",
                      border: `1px solid ${i === 6 ? "#f87171" : "#a78bfa"}40`,
                      color: i === 6 ? "#f87171" : "#a78bfa",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    {i < HEAL_SPEC.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: "#0e1a26", minHeight: "20px" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "0 0 20px 16px" }}>
                    <div style={{
                      color: i === 6 ? "#f87171" : "#a78bfa",
                      fontSize: "12px", fontWeight: 700, marginBottom: "4px",
                    }}>{s.step}</div>
                    <div style={{ color: "#3d5570", fontSize: "12px", lineHeight: 1.7 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key invariant */}
            <div style={{
              background: "rgba(167,139,250,0.05)",
              border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: "8px",
              padding: "18px 22px",
            }}>
              <div style={{ color: "#a78bfa", fontSize: "11px", letterSpacing: "1px", marginBottom: "8px" }}>
                KEY INVARIANT
              </div>
              <p style={{ margin: 0, color: "#2a4050", fontSize: "12px", lineHeight: 1.8 }}>
                <code style={{ color: "#a78bfa" }}>aether gen</code> never writes files to{" "}
                <code style={{ color: "#60a5fa" }}>src/</code> until conformance passes.
                All intermediate attempts are written to{" "}
                <code style={{ color: "#60a5fa" }}>.aether/gen-cache/</code> for debugging.
                If all 3 attempts fail, the developer receives a diagnostic report —
                not broken code silently placed in their project.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
