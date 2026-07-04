// src/providers/mock.ts
// The deterministic MockLLMProvider carried over from src/llm-provider.ts.
// It is used as the default when no API key is configured and as the only
// provider that does not require network access — this is what makes the
// experiment reproducible on a contributor's laptop without an LLM account.

import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';

const SIMULATED_LATENCY_MS = 1200;

export class MockLLMProvider implements LLMProvider {
  readonly id = 'mock';
  readonly defaultModel = 'mock-scenario-engine';

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, SIMULATED_LATENCY_MS));

    const files = pickScenario(req);

    return {
      files,
      tokensIn: Math.ceil(req.promptText.length / 4),
      tokensOut: Math.ceil(files.reduce((n, f) => n + f.content.length, 0) / 4),
      latencyMs: Math.round(performance.now() - t0),
      model: this.defaultModel,
      stopReason: 'end_turn',
    };
  }
}

function pickScenario(req: LLMRequest) {
  // Scenario 1: simple success
  if (req.targetDesc.includes('POST /tasks/:id/assign')) {
    return [
      {
        path: 'modules/tasks/routes/assign.ts',
        content:
`import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';
import { ok, err } from '/lib/result.js';

export async function POST(req: Request) {
  const user = await requireUser(req);
  return ok({ success: true });
}`,
      },
      {
        path: 'modules/tasks/routes/assign.test.ts',
        content: '// Test stub',
      },
    ];
  }

  // Scenario 2: self-healing demo (type error on attempt 1, fixed on attempt 2)
  if (req.targetDesc.includes('DELETE /tasks/:id')) {
    if (req.attempt === 1) {
      return [
        {
          path: 'modules/tasks/routes/delete.ts',
          content:
`import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  const taskId: string = "123";
  deleteTask(taskId);
  return new Response("OK");
}

function deleteTask(id: { _brand: 'TaskId' } & string) {}`,
        },
      ];
    }
    return [
      {
        path: 'modules/tasks/routes/delete.ts',
        content:
`import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  const taskId = "123" as { _brand: 'TaskId' } & string;
  deleteTask(taskId);
  return new Response("OK");
}

function deleteTask(id: { _brand: 'TaskId' } & string) {}`,
      },
    ];
  }

  // Scenario 3: exhausted — cross-module boundary violation that never resolves
  if (req.targetDesc.includes('transfer-team')) {
    return [
      {
        path: 'modules/tasks/routes/transfer.ts',
        content:
`import { requireUser } from '/lib/auth.js';
import { getTeam } from '../../teams/lib/queries.js';

export async function PATCH() {
  const user = await requireUser(new Request(""));
  getTeam();
  const teamId = null;
}`,
      },
    ];
  }

  return [];
}
