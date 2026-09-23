import { tool } from '@openai/agents';
import { z } from 'zod';
import { createImplementationInputGuardrail } from './implementation-input-guardrail.js';
import type { ImplementationContext } from './workflow-policy.js';

export function createImplementationTool<T>(
  context: ImplementationContext,
  executor: (task: string) => Promise<T> | T,
) {
  return tool({
    name: 'implement_task',
    description: 'Execute an implementation request when workflow prerequisites allow it.',
    parameters: z.strictObject({ task: z.string().min(1) }),
    needsApproval: true,
    inputGuardrails: [createImplementationInputGuardrail(context)],
    execute: async ({ task }) => executor(task),
  });
}
