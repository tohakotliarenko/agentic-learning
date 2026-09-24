import { tool, ToolGuardrailFunctionOutputFactory, type RunContext } from '@openai/agents';
import { z } from 'zod';
import { executeCommand } from './command-executor.js';
import { projectOutputGuardrail } from './project-output-guardrail.js';
import type { VerificationState } from './verification-policy.js';
import type { ImplementationContext } from './workflow-policy.js';
import { createImplementationInputGuardrail } from './implementation-input-guardrail.js';

export const projectCommands = {
  test: ['npm', ['test']],
  lint: ['npm', ['run', 'lint']],
  typecheck: ['npm', ['run', 'typecheck']],
  git_status: ['git', ['status', '--short']],
  git_diff: ['git', ['diff']],
} as const;

export type ProjectAction = keyof typeof projectCommands | 'implement';

export interface ImplementationCapability<T> {
  context: ImplementationContext;
  executor: (task: string) => Promise<T> | T;
}

export function createProjectCheckTool<T, U = never>(
  executor: (command: string) => Promise<T> | T,
  implementation?: ImplementationCapability<U>,
) {
  const actions: [ProjectAction, ...ProjectAction[]] = implementation
    ? ['test', 'lint', 'typecheck', 'git_status', 'git_diff', 'implement']
    : ['test', 'lint', 'typecheck', 'git_status', 'git_diff'];
  const parameters = z.strictObject({
    action: z.enum(actions),
    task: z.string().min(1).optional(),
  }).superRefine((input, ctx) => {
    if (input.action === 'implement' && input.task === undefined) {
      ctx.addIssue({ code: 'custom', path: ['task'], message: 'Implementation requires a task.' });
    } else if (input.action !== 'implement' && input.task !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['task'], message: 'Checks accept only an action.' });
    }
  });
  const workflowGuardrail = implementation
    ? createImplementationInputGuardrail(implementation.context) : undefined;

  return tool<typeof parameters, VerificationState>({
    name: 'run_project_check',
    description: 'Run a project check or request implementation when that capability is available.',
    needsApproval: async (_context, { action }) => implementation !== undefined && action === 'implement',
    inputGuardrails: workflowGuardrail ? [{
      name: workflowGuardrail.name,
      run: async (data) => {
        // The SDK can invoke guardrails even for invalid input. Leave shape errors
        // to its schema validation; scope workflow checks to implementation only.
        let input: unknown;
        try { input = JSON.parse(data.toolCall.arguments); }
        catch { return ToolGuardrailFunctionOutputFactory.allow(); }
        if (typeof input === 'object' && input !== null &&
          'action' in input && input.action === 'implement') {
          return workflowGuardrail.run(data);
        }
        return ToolGuardrailFunctionOutputFactory.allow();
      },
    }] : [],
    outputGuardrails: [projectOutputGuardrail],
    parameters,
    execute: async ({ action, task }, context?: RunContext<VerificationState>) => {
      if (action === 'implement') {
        if (!implementation || task === undefined) {
          throw new Error('Implementation capability and task are required.');
        }
        return implementation.executor(task);
      }
      if (!context) {
        throw new Error('Project checks require a verification run context.');
      }
      const [program, args] = projectCommands[action];
      const check = action === 'test' ? 'testsPassed'
        : action === 'lint' ? 'lintPassed'
        : action === 'typecheck' ? 'typecheckPassed' : undefined;
      // Update around the actual executor, so a policy block records no attempt.
      return executeCommand([program, ...args].join(' '), async (command) => {
        try {
          const result = await executor(command);
          if (check) context.context[check] = 'passed';
          return result;
        } catch (error) {
          if (check) context.context[check] = 'failed';
          throw error;
        }
      });
    },
  });
}
