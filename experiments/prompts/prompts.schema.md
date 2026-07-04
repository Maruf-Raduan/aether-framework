# Prompt Bank Schema

Each line in `prompts.jsonl` is a JSON object with the following fields.

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable identifier (P01–P30) used as the row key in result files. |
| `domain` | string | Business domain: `auth`, `tasks`, `billing`, `teams`, `notifications`, `reports`, `files`. |
| `route` | string | HTTP route signature, e.g. `POST /tasks/:id/assign`. |
| `complexity` | enum | `low` / `medium` / `high` — used for stratified analysis. |
| `target_rules` | string[] | The Aether rule IDs the prompt is designed to stress. See "Target rules" below. |
| `description` | string | The natural-language feature description fed verbatim to the LLM. |
| `edge_case` | string | Human-readable note on which guardrail is most at risk. |

## Target rules

| Rule | Description | Typical LLM failure mode |
|---|---|---|
| `C2` | Contract description ≥ 30 chars | Skimping on contract detail |
| `C5` | Invariants array non-empty | Forgetting to declare business invariants |
| `C8` | All declared dependencies are registered modules | Adding a cross-module import without declaring it |
| `G1` | No direct DB driver imports outside `/lib/db.ts` | Importing `pg`, `mysql2`, `drizzle-orm`, etc. directly |
| `G2` | Auth routes call `requireUser()` first | Omitting the call, or placing it after other statements |
| `G3` | No internal cross-module imports | Reaching into `modules/X/lib/...` instead of the public index |
| `G5` | TypeScript compiles with zero errors | Branded types, async signatures, missing imports |

## Stratification

- **By domain**: 4 auth · 9 tasks · 3 billing · 4 teams · 3 notifications · 2 reports · 3 files · 2 misc
- **By complexity**: 6 low · 17 medium · 7 high

## Coverage matrix

Each Aether rule in the G/C suite is hit by at least 5 distinct prompts, and every prompt targets at least one critical rule. This ensures the experiment is not biased toward trivially-passing scenarios.
