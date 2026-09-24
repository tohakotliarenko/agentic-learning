import type { CommandExecutionResult } from '../domain/command-execution-result.js';
import type { CommandExecutor } from '../ports/executors.js';
import { checkCommand } from '../policies/command-policy.js';

// Enforces the existing lexical policy, including its documented limitations.
export async function executeCommand<T>(
  command: string,
  executor: CommandExecutor<T>,
): Promise<CommandExecutionResult<T>> {
  const policy = checkCommand(command);
  if (!policy.allowed) {
    return { status: 'blocked', reason: policy.reason };
  }

  const result = await executor(command);
  return { status: 'executed', result };
}
