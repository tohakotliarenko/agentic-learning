import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import { executeCommand } from './command-executor.js';
import { projectOutputGuardrail } from './project-output-guardrail.js';
import type { VerificationState } from './verification-policy.js';

export const projectCommands = {
  test: ['npm', ['test']],
  lint: ['npm', ['run', 'lint']],
  typecheck: ['npm', ['run', 'typecheck']],
  git_status: ['git', ['status', '--short']],
  git_diff: ['git', ['diff']],
} as const;

export function createProjectCheckTool<T>(executor: (command: string) => Promise<T> | T) {
  return tool({
    name: 'run_project_check',
    description: 'Run one of the approved local project verification commands.',
    outputGuardrails: [projectOutputGuardrail],
    parameters: z.strictObject({
      action: z.enum(['test', 'lint', 'typecheck', 'git_status', 'git_diff']),
    }),
    execute: async ({ action }, context?: RunContext<VerificationState>) => {
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
