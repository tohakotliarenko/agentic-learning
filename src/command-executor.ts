import { checkCommand } from './command-policy.js';

export type CommandExecutionResult<T> =
  | { status: 'blocked'; reason: string }
  | { status: 'executed'; result: T };

// Enforces the existing lexical policy, including its documented limitations.
export async function executeCommand<T>(
  command: string,
  executor: (command: string) => Promise<T> | T,
): Promise<CommandExecutionResult<T>> {
  const policy = checkCommand(command);
  if (!policy.allowed) {
    return { status: 'blocked', reason: policy.reason };
  }

  const result = await executor(command);
  return { status: 'executed', result };
}
