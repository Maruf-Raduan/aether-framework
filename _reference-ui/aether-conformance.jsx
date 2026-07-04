import { useState } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const SUITE = [
  {
    id: "manifest",
    label: "Manifest",
    icon: "M",
    color: "#60a5fa",
    description: "Validates project.manifest structure, completeness, and internal consistency.",
    groups: [
      {
        id: "manifest-schema",
        name: "Schema Validity",
        tests: [
          { id: "m1", name: "manifest exists at project root", critical: true, aiImpact: "high",
            what: "project.manifest must exist at the root of every Aether project.",
            why: "Without it, AI tools have no context entry point — they'll hallucinate patterns.",
            pass: `{ "name": "my-app", "aether": "0.1.0", ... }`,
            fail: `// No project.manifest found at ./project.manifest` },
          { id: "m2", name: "required top-level fields present", critical: true, aiImpact: "high",
            what: "name, version, aether, intent, stack, patterns, modules must all be present.",
            why: "'intent' is the single most important field for AI — it anchors all code generation to the app's purpose.",
            pass: `{ "name":"app", "version":"1.0.0", "aether":"0.1.0",\n  "intent":"...", "stack":{...},\n  "patterns":{...}, "modules":[...] }`,
            fail: `{ "name":"app", "version":"1.0.0" }\n// Missing: intent, stack, patterns, modules` },
          { id: "m3", name: "aether version is semver", critical: true, aiImpact: "low",
            what: "The aether field must be a valid semver string.",
            why: "Tools use this to select the correct rule set for validation.",
            pass: `"aether": "0.1.0"`,
            fail: `"aether": "latest"` },
          { id: "m4", name: "intent field is non-empty string ≥ 20 chars", critical: true, aiImpact: "high",
            what: "intent must be a meaningful human-readable description, not a placeholder.",
            why: "A too-short intent (like 'my app') gives AI no useful grounding.",
            pass: `"intent": "A task management SaaS for small remote teams."`,
            fail: `"intent": "app"` },
        ],
      },
      {
        id: "manifest-modules",
        name: "Module Registry",
        tests: [
          { id: "m5", name: "each module path exists on disk", critical: true, aiImpact: "high",
            what: "Every path in the modules array must resolve to a real directory.",
            why: "Stale module entries cause AI to generate imports that resolve to nothing.",
            pass: `"modules": [{ "name":"auth", "path":"/modules/auth" }]\n// /modules/auth/ ✓ exists`,
            fail: `"modules": [{ "name":"auth", "path":"/modules/auth" }]\n// /modules/auth/ ✗ not found` },
          { id: "m6", name: "each module has a module.contract.ts", critical: true, aiImpact: "high",
            what: "Every registered module must have a module.contract.ts at its path root.",
            why: "Without a contract, AI has no typed entry point into the module.",
            pass: `// /modules/auth/module.contract.ts ✓`,
            fail: `// /modules/auth/module.contract.ts ✗ missing` },
          { id: "m7", name: "no duplicate module names", critical: true, aiImpact: "medium",
            what: "Module names in the registry must be globally unique.",
            why: "Duplicate names cause AI to generate ambiguous cross-module imports.",
            pass: `[{ "name":"auth" }, { "name":"tasks" }]`,
            fail: `[{ "name":"auth" }, { "name":"auth" }] // duplicate!` },
        ],
      },
      {
        id: "manifest-ai",
        name: "AI Configuration",
        tests: [
          { id: "m8", name: "ai.context file exists and is non-empty", critical: true, aiImpact: "high",
            what: "The path at ai.context must resolve to a readable, non-empty markdown file.",
            why: "This is the AI's briefing document — missing it means zero architectural context.",
            pass: `"ai": { "context": "./ai-context.md" }\n// ai-context.md: 847 bytes ✓`,
            fail: `"ai": { "context": "./ai-context.md" }\n// ai-context.md: 0 bytes ✗` },
          { id: "m9", name: "ai.constraints is array of strings", critical: false, aiImpact: "high",
            what: "ai.constraints must be a non-empty array of plain English constraint strings.",
            why: "These are hard rules injected into every AI generation prompt as guardrails.",
            pass: `"constraints": [\n  "No client-side state libraries",\n  "DB access only via /lib/db.ts"\n]`,
            fail: `"constraints": {} // object instead of array` },
        ],
      },
    ],
  },
  {
    id: "contract",
    label: "Contract",
    icon: "C",
    color: "#34d399",
    description: "Validates each module.contract.ts for completeness and internal consistency.",
    groups: [
      {
        id: "contract-schema",
        name: "Contract Schema",
        tests: [
          { id: "c1", name: "defineContract() is called as default export", critical: true, aiImpact: "high",
            what: "module.contract.ts must export a defineContract({...}) call as its default export.",
            why: "Aether's tooling and AI context injection both rely on this exact shape.",
            pass: `export default defineContract({ name: "tasks", ... })`,
            fail: `export const contract = { name: "tasks" } // not using defineContract` },
          { id: "c2", name: "description field is ≥ 30 chars", critical: true, aiImpact: "high",
            what: "The description must meaningfully explain what the module does.",
            why: "AI reads description before any implementation file — a vague description corrupts all downstream generation.",
            pass: `description: "Manages task CRUD, assignment, and status transitions for teams."`,
            fail: `description: "tasks"` },
          { id: "c3", name: "exposes.routes entries have method, path, auth", critical: true, aiImpact: "high",
            what: "Every route declaration must specify HTTP method, path pattern, and auth requirement.",
            why: "Missing auth:true on a route causes AI to silently generate unauthenticated handlers.",
            pass: `{ method:"POST", path:"/tasks", auth:true }`,
            fail: `{ method:"POST", path:"/tasks" } // auth missing — defaults to false!` },
          { id: "c4", name: "exposes.functions names match actual exports", critical: true, aiImpact: "medium",
            what: "Every string in exposes.functions must correspond to a real named export in the module.",
            why: "Phantom function names cause AI to generate calls to non-existent functions.",
            pass: `// contract: exposes.functions: ["createTask"]\n// index.ts: export async function createTask(...) ✓`,
            fail: `// contract: exposes.functions: ["createTask"]\n// index.ts: no export named createTask ✗` },
        ],
      },
      {
        id: "contract-invariants",
        name: "Invariant Coverage",
        tests: [
          { id: "c5", name: "invariants array is non-empty", critical: true, aiImpact: "high",
            what: "Every module must declare at least one business invariant.",
            why: "Invariants are the primary mechanism for AI to understand domain rules without reading implementation.",
            pass: `invariants: [\n  "A task must always belong to exactly one team",\n  "Only team members can be assigned"\n]`,
            fail: `invariants: [] // AI has no domain rules to respect` },
          { id: "c6", name: "each invariant has a generated test", critical: true, aiImpact: "high",
            what: "For every string in invariants, a test named after that invariant must exist in the module's test suite.",
            why: "Tests are AI-readable proof of invariants — they survive even if the contract file changes.",
            pass: `// invariant: "task must belong to one team"\n// tasks.invariants.test.ts:\n//   it("task must belong to exactly one team", ...)  ✓`,
            fail: `// invariant declared but no matching test found ✗` },
          { id: "c7", name: "sideEffects declared for all DB writes", critical: false, aiImpact: "medium",
            what: "Any function that writes to the database must have a matching entry in sideEffects.",
            why: "Undeclared side effects cause AI to misunderstand module boundaries and generate unsafe cross-module writes.",
            pass: `sideEffects: ["writes to: tasks table", "emits: task.created"]`,
            fail: `// module writes to tasks table but sideEffects is empty` },
        ],
      },
      {
        id: "contract-deps",
        name: "Dependency Integrity",
        tests: [
          { id: "c8", name: "all declared dependencies are registered modules", critical: true, aiImpact: "medium",
            what: "Every name in dependencies.modules must exist in project.manifest modules registry.",
            why: "Unregistered dependencies cause AI to generate imports that don't exist.",
            pass: `dependencies: { modules: ["auth", "teams"] }\n// both "auth" and "teams" in manifest ✓`,
            fail: `dependencies: { modules: ["auth", "payments"] }\n// "payments" not in manifest ✗` },
          { id: "c9", name: "no circular module dependencies", critical: true, aiImpact: "medium",
            what: "The dependency graph across all modules must be a DAG — no cycles.",
            why: "Circular deps confuse AI about call order and cause it to generate deadlocked async code.",
            pass: `auth → (no deps)\ntasks → auth, teams\nteams → auth`,
            fail: `auth → tasks\ntasks → auth  // cycle! ✗` },
        ],
      },
    ],
  },
  {
    id: "context",
    label: "AI Context",
    icon: "A",
    color: "#f472b6",
    description: "Validates the ai-context.md briefing document for completeness and AI-readability.",
    groups: [
      {
        id: "context-structure",
        name: "Document Structure",
        tests: [
          { id: "a1", name: "contains ## Architecture decisions section", critical: true, aiImpact: "high",
            what: "ai-context.md must have a section explaining key architectural decisions.",
            why: "Without WHY explanations, AI will override architecture decisions it doesn't understand.",
            pass: `## Architecture decisions (and WHY)\n- **Server-first**: We prioritize SEO...`,
            fail: `// No architecture section found` },
          { id: "a2", name: "contains ## Key files section", critical: true, aiImpact: "high",
            what: "The context doc must enumerate critical shared files with their paths.",
            why: "AI needs an explicit map to shared utilities — without it, it reimplements them.",
            pass: `## Key files\n- /lib/db.ts — all database access\n- /lib/auth.ts — requireUser()`,
            fail: `// No key files section — AI will generate duplicate utilities` },
          { id: "a3", name: "contains ## Things AI commonly gets wrong section", critical: false, aiImpact: "high",
            what: "A section pre-listing known AI failure modes for this specific codebase.",
            why: "Pre-emptive correction is more reliable than reactive correction. This section is injected into every generation prompt.",
            pass: `## Things AI commonly gets wrong here\n- Do NOT use try/catch for business errors\n- Do NOT import directly from /modules/*`,
            fail: `// No common mistakes section — errors repeat across sessions` },
        ],
      },
      {
        id: "context-quality",
        name: "Content Quality",
        tests: [
          { id: "a4", name: "all /lib/ paths in context exist on disk", critical: true, aiImpact: "medium",
            what: "Every file path mentioned in ai-context.md must resolve to a real file.",
            why: "Stale paths in context cause AI to import from files that don't exist.",
            pass: `// context mentions /lib/db.ts → exists ✓`,
            fail: `// context mentions /lib/database.ts → not found ✗` },
          { id: "a5", name: "word count ≥ 200", critical: false, aiImpact: "medium",
            what: "The context doc must have at least 200 words to be considered substantive.",
            why: "Minimal context docs give AI too little to work with — resulting in generic, pattern-mismatched code.",
            pass: `// ai-context.md: 847 words ✓`,
            fail: `// ai-context.md: 43 words ✗ — too sparse` },
        ],
      },
    ],
  },
  {
    id: "generation",
    label: "Generation",
    icon: "G",
    color: "#fbbf24",
    description: "Validates that AI-generated code conforms to the contracts and constraints it was given.",
    groups: [
      {
        id: "gen-constraints",
        name: "Constraint Adherence",
        tests: [
          { id: "g1", name: "no direct DB imports outside /lib/db.ts", critical: true, aiImpact: "high",
            what: "If ai.constraints declares 'DB access only via /lib/db.ts', scan all generated files for direct db driver imports.",
            why: "AI frequently bypasses abstraction layers — this catches it automatically.",
            pass: `// tasks/routes/create.ts\nimport { db } from "/lib/db.ts" ✓`,
            fail: `// tasks/routes/create.ts\nimport { Pool } from "pg" ✗ — constraint violated` },
          { id: "g2", name: "auth constraint respected on all generated routes", critical: true, aiImpact: "high",
            what: "Every generated route marked auth:true in the contract must call requireUser() before any logic.",
            why: "Missing auth checks are the #1 security issue in AI-generated route handlers.",
            pass: `export async function handler(req) {\n  const user = await requireUser(req) // ✓ first line\n  ...`,
            fail: `export async function handler(req) {\n  const tasks = await getTasks() // ✗ no auth check!` },
          { id: "g3", name: "no undeclared module cross-imports", critical: true, aiImpact: "medium",
            what: "Modules must not import from other modules' internal files — only from their declared exposes.",
            why: "AI frequently reaches into module internals, bypassing the contract boundary.",
            pass: `import { createTask } from "@modules/tasks" // via exposed function ✓`,
            fail: `import { taskQuery } from "@modules/tasks/lib/queries" // internal! ✗` },
        ],
      },
      {
        id: "gen-invariants",
        name: "Invariant Tests Pass",
        tests: [
          { id: "g4", name: "all invariant tests pass after generation", critical: true, aiImpact: "high",
            what: "After every generation cycle, the full invariant test suite must pass.",
            why: "Invariant tests are the final gate — they verify business rules are preserved regardless of what AI changed.",
            pass: `✓ task must belong to exactly one team (4ms)\n✓ only team members can be assigned (2ms)\n✓ deleted tasks are soft-deleted (3ms)`,
            fail: `✗ task must belong to exactly one team\n  Expected: teamId to be non-null\n  Received: null` },
          { id: "g5", name: "type check passes with zero errors", critical: true, aiImpact: "medium",
            what: "Generated TypeScript must compile cleanly — no type errors, no 'any' escape hatches.",
            why: "Type errors in AI-generated code are a leading indicator of contract misunderstanding.",
            pass: `tsc --noEmit → 0 errors ✓`,
            fail: `tsc --noEmit → 3 errors\n  TS2345: Argument of type 'string' is not\n  assignable to parameter of type 'UserId'` },
        ],
      },
    ],
  },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const Badge = ({ children, color, small }) => (
  <span style={{
    background: `${color}18`,
    border: `1px solid ${color}40`,
    color,
    borderRadius: "4px",
    padding: small ? "1px 6px" : "2px 8px",
    fontSize: small ? "10px" : "11px",
    fontFamily: "monospace",
    letterSpacing: "0.5px",
    fontWeight: 600,
  }}>
    {children}
  </span>
);

const ImpactDot = ({ level }) => {
  const colors = { high: "#f87171", medium: "#fbbf24", low: "#34d399" };
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: colors[level],
        boxShadow: `0 0 6px ${colors[level]}`,
        display: "inline-block",
      }} />
      <span style={{ color: colors[level], fontSize: "10px", fontFamily: "monospace" }}>
        AI {level}
      </span>
    </span>
  );
};

const TestDetail = ({ test, accentColor }) => {
  const [tab, setTab] = useState("what");
  const tabs = [
    { id: "what", label: "What" },
    { id: "why", label: "Why it matters for AI" },
    { id: "pass", label: "✓ Pass" },
    { id: "fail", label: "✗ Fail" },
  ];
  return (
    <div style={{
      background: "#0a0f18",
      border: `1px solid ${accentColor}30`,
      borderRadius: "8px",
      overflow: "hidden",
      marginTop: "8px",
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid #1a2232" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? `${accentColor}12` : "transparent",
            border: "none",
            borderBottom: tab === t.id ? `2px solid ${accentColor}` : "2px solid transparent",
            color: tab === t.id ? accentColor : "#3d4f63",
            padding: "8px 14px",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "monospace",
            letterSpacing: "0.3px",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "14px 16px" }}>
        {tab === "what" && <p style={{ color: "#7a8fa8", fontSize: "12px", lineHeight: 1.7, margin: 0 }}>{test.what}</p>}
        {tab === "why" && <p style={{ color: "#7a8fa8", fontSize: "12px", lineHeight: 1.7, margin: 0 }}>{test.why}</p>}
        {(tab === "pass" || tab === "fail") && (
          <pre style={{
            background: tab === "pass" ? "rgba(52,211,153,0.05)" : "rgba(248,113,113,0.05)",
            border: `1px solid ${tab === "pass" ? "#34d39930" : "#f8717130"}`,
            borderRadius: "6px",
            padding: "12px",
            margin: 0,
            fontSize: "11px",
            color: tab === "pass" ? "#34d399" : "#f87171",
            fontFamily: "monospace",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>
            {tab === "pass" ? test.pass : test.fail}
          </pre>
        )}
      </div>
    </div>
  );
};

const TestRow = ({ test, accentColor }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #0f1823" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 16px",
          cursor: "pointer",
          background: open ? `${accentColor}06` : "transparent",
          transition: "background 0.15s",
        }}
      >
        <span style={{
          fontFamily: "monospace", fontSize: "10px",
          color: "#2a3a4e", width: "28px", flexShrink: 0,
        }}>{test.id}</span>

        <span style={{ flex: 1, fontSize: "13px", color: "#c0cad8", fontFamily: "monospace" }}>
          {test.name}
        </span>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          <ImpactDot level={test.aiImpact} />
          {test.critical && <Badge color="#f87171" small>critical</Badge>}
          <span style={{
            color: open ? accentColor : "#2a3a4e",
            fontSize: "14px",
            transition: "transform 0.2s, color 0.2s",
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}>›</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 14px" }}>
          <TestDetail test={test} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
};

const SuitePanel = ({ suite }) => {
  const allTests = suite.groups.flatMap(g => g.tests);
  const critical = allTests.filter(t => t.critical).length;
  const highImpact = allTests.filter(t => t.aiImpact === "high").length;

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>
            <span style={{ color: suite.color }}>{suite.icon}</span> {suite.label} Conformance
          </h2>
        </div>
        <p style={{ margin: "0 0 16px", color: "#4a6070", fontSize: "13px", lineHeight: 1.7 }}>
          {suite.description}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <Badge color={suite.color}>{allTests.length} tests</Badge>
          <Badge color="#f87171">{critical} critical</Badge>
          <Badge color="#f87171">{highImpact} high AI impact</Badge>
        </div>
      </div>

      {suite.groups.map(group => (
        <div key={group.id} style={{ marginBottom: "20px" }}>
          <div style={{
            padding: "8px 16px",
            background: "#0a0f18",
            borderLeft: `3px solid ${suite.color}`,
            marginBottom: "2px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <span style={{ color: suite.color, fontFamily: "monospace", fontSize: "12px", fontWeight: 700 }}>
              {group.name}
            </span>
            <span style={{ color: "#2a3a4e", fontSize: "11px" }}>
              {group.tests.length} tests
            </span>
          </div>
          <div style={{ border: "1px solid #0f1823", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
            {group.tests.map(test => (
              <TestRow key={test.id} test={test} accentColor={suite.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Overview = () => {
  const allTests = SUITE.flatMap(s => s.groups.flatMap(g => g.tests));
  const critical = allTests.filter(t => t.critical).length;
  const highImpact = allTests.filter(t => t.aiImpact === "high").length;

  return (
    <div>
      <div style={{ marginBottom: "40px" }}>
        <div style={{ color: "#60a5fa", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontFamily: "monospace" }}>
          Aether Framework
        </div>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#e2e8f0", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          Conformance Test Suite
        </h1>
        <p style={{ color: "#3d5060", fontSize: "14px", margin: "0 0 24px", lineHeight: 1.7, maxWidth: 520 }}>
          A language-agnostic specification of rules that any Aether-compatible tool, AI agent, or linter must satisfy.
          Tests are grouped by <em style={{ color: "#60a5fa" }}>AI impact</em> — how badly a violation degrades code generation quality.
        </p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            ["Total Tests", allTests.length, "#60a5fa"],
            ["Critical", critical, "#f87171"],
            ["High AI Impact", highImpact, "#f87171"],
            ["Suites", SUITE.length, "#34d399"],
          ].map(([label, val, color]) => (
            <div key={label} style={{
              background: "#0a0f18",
              border: "1px solid #1a2232",
              borderRadius: "8px",
              padding: "14px 20px",
              textAlign: "center",
              minWidth: "90px",
            }}>
              <div style={{ fontSize: "26px", fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
              <div style={{ fontSize: "10px", color: "#2d4050", marginTop: "2px", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "28px" }}>
        <div style={{ color: "#3d5060", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px", fontFamily: "monospace" }}>
          How AI Impact is scored
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: 560 }}>
          {[
            ["high", "#f87171", "Violation directly corrupts AI-generated code — auth missing, wrong patterns, phantom imports."],
            ["medium", "#fbbf24", "Violation causes subtle bugs that AI won't catch — circular deps, stale paths, ambiguous names."],
            ["low", "#34d399", "Violation causes tooling errors or warnings but doesn't degrade generation quality."],
          ].map(([level, color, desc]) => (
            <div key={level} style={{
              display: "flex", gap: "14px", alignItems: "flex-start",
              background: "#0a0f18", border: "1px solid #1a2232",
              borderRadius: "6px", padding: "12px 16px",
            }}>
              <ImpactDot level={level} />
              <p style={{ margin: 0, color: "#4a6070", fontSize: "12px", lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: "#3d5060", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px", fontFamily: "monospace" }}>
          Suite Map
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {SUITE.map(s => {
            const tests = s.groups.flatMap(g => g.tests);
            return (
              <div key={s.id} style={{
                background: "#0a0f18",
                border: `1px solid ${s.color}25`,
                borderRadius: "8px",
                padding: "16px",
              }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "6px",
                    background: `${s.color}15`, color: s.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", fontWeight: 700, fontFamily: "monospace",
                    border: `1px solid ${s.color}30`,
                    flexShrink: 0,
                  }}>{s.icon}</span>
                  <span style={{ color: "#c0cad8", fontWeight: 600, fontSize: "14px" }}>{s.label}</span>
                </div>
                <p style={{ margin: "0 0 10px", color: "#3d5060", fontSize: "12px", lineHeight: 1.6 }}>
                  {s.description}
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Badge color={s.color} small>{tests.length} tests</Badge>
                  <Badge color="#f87171" small>{tests.filter(t => t.critical).length} critical</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [active, setActive] = useState("overview");

  const navItems = [
    { id: "overview", label: "Overview", icon: "◈", color: "#60a5fa" },
    ...SUITE.map(s => ({ id: s.id, label: s.label, icon: s.icon, color: s.color })),
  ];

  const activeSuite = SUITE.find(s => s.id === active);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b12",
      color: "#c9d1d9",
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      display: "flex",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "190px",
        flexShrink: 0,
        borderRight: "1px solid #0f1823",
        padding: "28px 0",
        display: "flex",
        flexDirection: "column",
        background: "#040810",
      }}>
        <div style={{ padding: "0 18px 28px" }}>
          <div style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 700, letterSpacing: "1px" }}>
            ◈ AETHER
          </div>
          <div style={{ color: "#1e3040", fontSize: "10px", marginTop: "3px", letterSpacing: "1px" }}>
            CONFORMANCE SUITE
          </div>
        </div>

        {navItems.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            background: active === item.id ? `${item.color}10` : "transparent",
            border: "none",
            borderLeft: `2px solid ${active === item.id ? item.color : "transparent"}`,
            color: active === item.id ? item.color : "#2d4050",
            padding: "9px 18px",
            textAlign: "left",
            cursor: "pointer",
            fontSize: "12px",
            fontFamily: "inherit",
            transition: "all 0.15s",
            letterSpacing: "0.5px",
          }}>
            {item.icon} {item.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", padding: "18px", borderTop: "1px solid #0f1823" }}>
          <div style={{ color: "#1a2a38", fontSize: "10px", lineHeight: 1.6 }}>
            v0.1 · {SUITE.flatMap(s => s.groups.flatMap(g => g.tests)).length} tests
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "36px 44px", overflowY: "auto", maxWidth: "860px" }}>
        {active === "overview" ? <Overview /> : activeSuite ? <SuitePanel suite={activeSuite} /> : null}
      </div>
    </div>
  );
}
