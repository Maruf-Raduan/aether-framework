import { useState } from "react";

const sections = [
  {
    id: "overview",
    label: "Overview",
    icon: "◈",
    content: {
      title: "Aether Framework",
      subtitle: "An AI-First Web Framework",
      tagline: "Designed for the developer who codes with AI, not despite it.",
      description: `Most frameworks were designed for humans to write by hand. Aether is different — every design decision optimizes for how LLMs read, generate, and reason about code. Less magic. More contracts. Full context at all times.`,
    },
  },
  {
    id: "manifest",
    label: "project.manifest",
    icon: "⬡",
    content: {
      title: "project.manifest",
      subtitle: "The single source of truth — for you AND the AI.",
      description: "Every Aether project has a root-level project.manifest. It's machine-readable JSON that any AI tool can parse before generating a single line of code. It replaces implicit conventions with explicit declarations.",
      code: `{
  "name": "my-app",
  "version": "1.0.0",
  "aether": "0.1.0",

  "intent": "A task management SaaS for small teams.",

  "stack": {
    "runtime": "bun",
    "language": "typescript",
    "rendering": "server-first",
    "database": "postgres",
    "auth": "jwt"
  },

  "patterns": {
    "routing": "file-based",
    "dataFetching": "loader-pattern",
    "errorHandling": "result-type",
    "styling": "css-modules"
  },

  "ai": {
    "context": "./ai-context.md",
    "constraints": [
      "No client-side state libraries",
      "All DB access only via /lib/db.ts",
      "Auth checks must use requireUser() helper"
    ],
    "preferredPatterns": [
      "Prefer async/await over .then()",
      "Use zod for all input validation",
      "Colocate tests with source files"
    ]
  },

  "modules": [
    { "name": "auth",   "path": "/modules/auth" },
    { "name": "tasks",  "path": "/modules/tasks" },
    { "name": "teams",  "path": "/modules/teams" }
  ]
}`,
      annotations: [
        { key: "intent", note: "Human-readable purpose — AI reads this first to understand the app." },
        { key: "ai.constraints", note: "Hard rules the AI must never violate when generating code." },
        { key: "ai.preferredPatterns", note: "Soft conventions the AI should follow by default." },
        { key: "modules", note: "Explicit module registry — no guessing from folder structure." },
      ],
    },
  },
  {
    id: "module",
    label: "module.contract",
    icon: "⬡",
    content: {
      title: "module.contract.ts",
      subtitle: "Every module declares its inputs, outputs, and side effects.",
      description: "A module.contract file lives inside each module folder. It's the AI's entry point into that module — it tells the AI exactly what the module does, what it depends on, and what it exposes.",
      code: `// modules/tasks/module.contract.ts
import { defineContract } from "aether";

export default defineContract({
  name: "tasks",
  version: "1.0.0",

  description: "Manages task CRUD, assignment, and status transitions.",

  dependencies: {
    modules: ["auth", "teams"],
    external: ["postgres", "zod"],
  },

  exposes: {
    routes: [
      { method: "GET",    path: "/tasks",      auth: true },
      { method: "POST",   path: "/tasks",      auth: true },
      { method: "PATCH",  path: "/tasks/:id",  auth: true },
      { method: "DELETE", path: "/tasks/:id",  auth: true, role: "admin" },
    ],
    functions: [
      "createTask",
      "updateTaskStatus",
      "assignTask",
      "getTasksForUser",
    ],
    types: [
      "Task",
      "TaskStatus",
      "CreateTaskInput",
    ],
  },

  sideEffects: [
    "writes to: tasks table",
    "reads from: users table, teams table",
    "emits event: task.created, task.assigned",
  ],

  invariants: [
    "A task must always belong to exactly one team",
    "Only team members can be assigned to a task",
    "Deleted tasks are soft-deleted, never hard-deleted",
  ],
});`,
      annotations: [
        { key: "description", note: "Plain-English summary — AI reads this before reading any implementation." },
        { key: "invariants", note: "Business rules that must ALWAYS hold. AI uses these as constraints when generating logic." },
        { key: "sideEffects", note: "Explicit side effect declaration — no hidden DB writes or event emissions." },
        { key: "exposes.routes", note: "Typed route registry — AI knows the full API surface without scanning files." },
      ],
    },
  },
  {
    id: "context",
    label: "ai-context.md",
    icon: "◈",
    content: {
      title: "ai-context.md",
      subtitle: "A briefing document written for AI, not humans.",
      description: "This file is the first thing injected into any AI coding session. It gives the AI what it needs to generate correct, idiomatic code without hallucinating patterns.",
      code: `# AI Context: my-app

## What this app does
A task management SaaS. Teams create projects, 
assign tasks, and track progress. Think Linear, but simpler.

## Architecture decisions (and WHY)
- **Server-first rendering**: We prioritize SEO and 
  initial load speed. Avoid client components unless 
  the user interaction strictly requires it.
  
- **Result type for errors**: We do NOT throw exceptions 
  for business logic errors. Use the Result<T, E> type 
  from /lib/result.ts instead. Throw only for truly 
  unexpected runtime errors.

- **No ORM**: We use raw SQL via /lib/db.ts. 
  Never import pg directly in modules.

## Key files AI should know about
- /lib/db.ts       — all database access
- /lib/auth.ts     — requireUser(), getSession()
- /lib/result.ts   — Result<T,E> type
- /lib/events.ts   — event emitter for domain events
- /types/index.ts  — shared domain types

## Patterns to always follow
1. Validate all external input with Zod at the boundary
2. requireUser() at the top of every authenticated route
3. Emit a domain event for every state-changing operation
4. Log errors with logger.error(), never console.log()

## Things AI commonly gets wrong here
- Do NOT use try/catch for business errors, use Result
- Do NOT import directly from /modules/* in other modules
  (use the exposed functions from module.contract only)
- Do NOT write raw SQL outside of /lib/db.ts`,
      annotations: [
        { key: "WHY", note: "Explaining the 'why' behind decisions prevents AI from overriding them." },
        { key: "commonly gets wrong", note: "Pre-emptively correcting common AI mistakes before they happen." },
      ],
    },
  },
  {
    id: "healing",
    label: "Self-Healing",
    icon: "↺",
    content: {
      title: "Built-in Self-Healing Loop",
      subtitle: "Generate → Test → Diagnose → Regenerate",
      description: "Aether's CLI includes an aether gen command with a self-healing loop. When AI-generated code fails tests or type checks, the errors are automatically fed back to the AI with context, triggering a correction cycle.",
      code: `# Generate a new route with AI
$ aether gen route "POST /tasks/:id/assign"

  ◈ Reading project.manifest...
  ◈ Reading modules/tasks/module.contract.ts...
  ◈ Reading ai-context.md...
  ◈ Calling AI (claude-sonnet-4)...

  ✓ Generated: modules/tasks/routes/assign.ts
  ✓ Generated: modules/tasks/routes/assign.test.ts

  ↺ Running type check...
    ✗ Error: Argument of type 'string' is not assignable 
      to parameter of type 'UserId'
      at assign.ts:14

  ↺ Self-healing (attempt 1/3)...
    → Injecting error + contract context into AI...
    → Regenerating assign.ts...

  ✓ Type check passed
  ✓ Running tests... 3/3 passed

  ◈ Done. Review: modules/tasks/routes/assign.ts`,
      annotations: [
        { key: "Reading project.manifest", note: "Full context is injected BEFORE generation — not after errors." },
        { key: "Self-healing", note: "Errors + original contract are re-sent to AI. Up to 3 correction attempts." },
        { key: "Generated test file", note: "Tests are generated alongside implementation — not as an afterthought." },
      ],
    },
  },
  {
    id: "principles",
    label: "Design Principles",
    icon: "◆",
    content: {
      title: "Core Design Principles",
      subtitle: "The philosophy behind every decision.",
      principles: [
        {
          name: "Explicit over Implicit",
          detail: "Every convention that could be hidden is instead declared. File-based routing is fine — but the full route table is also in project.manifest so AI doesn't have to infer it.",
        },
        {
          name: "Context-First Generation",
          detail: "No AI tool should generate code without first reading the manifest, the relevant contract, and ai-context.md. The CLI enforces this. The IDE extension enforces this.",
        },
        {
          name: "Contracts as Truth",
          detail: "module.contract.ts is the single source of truth for what a module does. If the implementation diverges from the contract, the conformance checker catches it.",
        },
        {
          name: "Minimal DSL",
          detail: "Aether introduces no new syntax. It's TypeScript + a small set of typed helper functions. An AI that knows TypeScript knows Aether.",
        },
        {
          name: "Verifiable Invariants",
          detail: "Business rules declared in contracts are tested by a generated invariant test suite. AI can read the tests to understand the rules even without reading the contract.",
        },
        {
          name: "Stable Surface Area",
          detail: "Major versions are frozen for 2 years. The AI tools trained on Aether v1 still work on Aether v1.x. No rewrites every 18 months.",
        },
      ],
    },
  },
];

const CodeBlock = ({ code, annotations = [] }) => {
  const [hoveredKey, setHoveredKey] = useState(null);

  const annotatedKeys = annotations.map((a) => a.key);

  const renderLine = (line, idx) => {
    const matchedAnnotation = annotations.find((a) => line.includes(a.key));
    const isHighlighted = matchedAnnotation && hoveredKey === matchedAnnotation.key;

    return (
      <div
        key={idx}
        style={{
          background: isHighlighted ? "rgba(99,211,168,0.08)" : "transparent",
          borderLeft: isHighlighted ? "2px solid #63d3a8" : "2px solid transparent",
          paddingLeft: "8px",
          marginLeft: "-10px",
          transition: "all 0.2s",
        }}
      >
        <span style={{ color: "#4a5568", userSelect: "none", marginRight: "16px", fontSize: "11px" }}>
          {String(idx + 1).padStart(2, " ")}
        </span>
        <span dangerouslySetInnerHTML={{ __html: colorize(line) }} />
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <div
        style={{
          flex: 1,
          background: "#0d1117",
          borderRadius: "8px",
          padding: "20px",
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          fontSize: "12px",
          lineHeight: "1.8",
          overflowX: "auto",
          border: "1px solid #1e2a38",
        }}
      >
        {code.split("\n").map((line, idx) => renderLine(line, idx))}
      </div>
      {annotations.length > 0 && (
        <div style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {annotations.map((a) => (
            <div
              key={a.key}
              onMouseEnter={() => setHoveredKey(a.key)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                background: hoveredKey === a.key ? "rgba(99,211,168,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${hoveredKey === a.key ? "#63d3a8" : "#1e2a38"}`,
                borderRadius: "6px",
                padding: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ color: "#63d3a8", fontFamily: "monospace", fontSize: "11px", marginBottom: "4px" }}>
                {a.key}
              </div>
              <div style={{ color: "#8892a4", fontSize: "11px", lineHeight: "1.5" }}>{a.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function colorize(line) {
  return line
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/.*$)/g, '<span style="color:#546e7a">$1</span>')
    .replace(/(#.*$)/g, '<span style="color:#546e7a">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#a8d8a8">$1</span>')
    .replace(/\b(import|export|default|from|const|let|type|interface|async|await|return|true|false|null)\b/g,
      '<span style="color:#c792ea">$1</span>')
    .replace(/\b(defineContract|defineModule|requireUser|Result)\b/g,
      '<span style="color:#82aaff">$1</span>')
    .replace(/\b(\d+\.\d+\.\d+|\d+)\b/g, '<span style="color:#f78c6c">$1</span>');
}

export default function AetherSpec() {
  const [active, setActive] = useState("overview");
  const section = sections.find((s) => s.id === active);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080c12",
        color: "#c9d1d9",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        display: "flex",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "200px",
          flexShrink: 0,
          borderRight: "1px solid #1e2a38",
          padding: "32px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "0 20px 32px" }}>
          <div style={{ color: "#63d3a8", fontSize: "18px", fontWeight: "700", letterSpacing: "-0.5px" }}>
            ◈ aether
          </div>
          <div style={{ color: "#4a5568", fontSize: "11px", marginTop: "4px" }}>framework spec v0.1</div>
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            style={{
              background: active === s.id ? "rgba(99,211,168,0.08)" : "transparent",
              border: "none",
              borderLeft: `3px solid ${active === s.id ? "#63d3a8" : "transparent"}`,
              color: active === s.id ? "#e2e8f0" : "#5a6478",
              padding: "10px 20px",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "inherit",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ color: active === s.id ? "#63d3a8" : "#2d3748" }}>{s.icon}</span>
            {s.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", padding: "20px", borderTop: "1px solid #1e2a38" }}>
          <div style={{ color: "#2d3748", fontSize: "10px", lineHeight: "1.6" }}>
            Designed for the developer who codes with AI, not despite it.
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "40px 48px", overflowY: "auto", maxWidth: "900px" }}>
        {section.id === "overview" && (
          <div>
            <div style={{ marginBottom: "48px" }}>
              <div style={{ color: "#63d3a8", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>
                Framework Design Specification
              </div>
              <h1 style={{ fontSize: "42px", fontWeight: "800", letterSpacing: "-1px", color: "#e2e8f0", margin: "0 0 8px" }}>
                {section.content.title}
              </h1>
              <div style={{ fontSize: "18px", color: "#63d3a8", fontWeight: "500", marginBottom: "24px" }}>
                {section.content.subtitle}
              </div>
              <div style={{ fontSize: "16px", color: "#8892a4", lineHeight: "1.8", maxWidth: "600px" }}>
                {section.content.tagline}
              </div>
            </div>

            <div
              style={{
                background: "rgba(99,211,168,0.05)",
                border: "1px solid rgba(99,211,168,0.2)",
                borderRadius: "12px",
                padding: "28px",
                marginBottom: "40px",
                fontSize: "15px",
                color: "#8892a4",
                lineHeight: "1.9",
                maxWidth: "640px",
              }}
            >
              {section.content.description}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "640px" }}>
              {[
                ["project.manifest", "Machine-readable project truth"],
                ["module.contract", "Explicit module declarations"],
                ["ai-context.md", "AI briefing document"],
                ["Self-Healing CLI", "Generate → test → fix loop"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid #1e2a38",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: "13px", marginBottom: "6px" }}>
                    {title}
                  </div>
                  <div style={{ color: "#4a5568", fontSize: "12px" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(section.id === "manifest" || section.id === "module" || section.id === "context" || section.id === "healing") && (
          <div>
            <div style={{ marginBottom: "32px" }}>
              <div style={{ color: "#63d3a8", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>
                {section.icon} Core Primitive
              </div>
              <h2 style={{ fontSize: "28px", fontWeight: "700", color: "#e2e8f0", margin: "0 0 8px", fontFamily: "monospace" }}>
                {section.content.title}
              </h2>
              <div style={{ color: "#63d3a8", fontSize: "14px", marginBottom: "16px" }}>{section.content.subtitle}</div>
              <div style={{ color: "#6b7888", fontSize: "14px", lineHeight: "1.8", maxWidth: "600px" }}>
                {section.content.description}
              </div>
            </div>
            <CodeBlock code={section.content.code} annotations={section.content.annotations} />
          </div>
        )}

        {section.id === "principles" && (
          <div>
            <div style={{ marginBottom: "36px" }}>
              <div style={{ color: "#63d3a8", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>
                ◆ Philosophy
              </div>
              <h2 style={{ fontSize: "28px", fontWeight: "700", color: "#e2e8f0", margin: "0 0 8px" }}>
                {section.content.title}
              </h2>
              <div style={{ color: "#63d3a8", fontSize: "14px" }}>{section.content.subtitle}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {section.content.principles.map((p, i) => (
                <div
                  key={p.name}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid #1e2a38",
                    borderRadius: "10px",
                    padding: "20px 24px",
                    display: "flex",
                    gap: "20px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      color: "#63d3a8",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      background: "rgba(99,211,168,0.08)",
                      border: "1px solid rgba(99,211,168,0.2)",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    P{i + 1}
                  </div>
                  <div>
                    <div style={{ color: "#e2e8f0", fontWeight: "600", marginBottom: "6px", fontSize: "15px" }}>
                      {p.name}
                    </div>
                    <div style={{ color: "#6b7888", fontSize: "13px", lineHeight: "1.7" }}>{p.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
