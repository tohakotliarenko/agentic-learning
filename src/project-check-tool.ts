import { tool } from '@openai/agents';
import { z } from 'zod';
import { executeCommand } from './command-executor.js';
import { projectOutputGuardrail } from './project-output-guardrail.js';

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
    execute: async ({ action }) => {
      const [program, args] = projectCommands[action];
      return executeCommand([program, ...args].join(' '), executor);
    },
  });
}
