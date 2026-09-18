import { executeCommand, type CommandExecutionResult } from './command-executor.js';
import {
  checkImplementationContext,
  type ImplementationContext,
  type ImplementationPrerequisite,
} from './workflow-policy.js';

export type ImplementationExecutionResult<T> =
  | { status: 'workflow-blocked'; missingPrerequisites: ImplementationPrerequisite[] }
  | CommandExecutionResult<T>;

export async function executeImplementationCommand<T>(
  context: ImplementationContext,
  command: string,
  executor: (command: string) => Promise<T> | T,
): Promise<ImplementationExecutionResult<T>> {
  const workflow = checkImplementationContext(context);
  if (!workflow.allowed) {
    return { status: 'workflow-blocked', missingPrerequisites: workflow.missingPrerequisites };
  }

  return executeCommand(command, executor);
}
