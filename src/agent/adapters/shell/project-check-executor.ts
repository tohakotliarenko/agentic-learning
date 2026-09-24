import { executeCommand } from '../../application/command-executor.js';
import type { CommandExecutor, ProjectCheckExecutor } from '../../ports/executors.js';

export const projectCommands = {
  test: ['npm', ['test']],
  lint: ['npm', ['run', 'lint']],
  typecheck: ['npm', ['run', 'typecheck']],
  git_status: ['git', ['status', '--short']],
  git_diff: ['git', ['diff']],
} as const;

export function createShellProjectCheckExecutor<T>(executor: CommandExecutor<T>): ProjectCheckExecutor<T> {
  return (action) => {
    const [program, args] = projectCommands[action];
    return executeCommand([program, ...args].join(' '), executor);
  };
}
