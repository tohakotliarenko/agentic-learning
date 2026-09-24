import { executeCommand } from './command-executor.js';
import type { CommandExecutionResult } from '../domain/command-execution-result.js';
import type { CommandExecutor } from '../ports/executors.js';
import { checkImplementationContext } from '../policies/workflow-policy.js';
import type { ImplementationContext, ImplementationPrerequisite } from '../domain/implementation-context.js';

export type ImplementationExecutionResult<T> =
  | { status: 'workflow-blocked'; missingPrerequisites: ImplementationPrerequisite[] }
  | CommandExecutionResult<T>;

export async function executeImplementationCommand<T>(
  context: ImplementationContext,
  command: string,
  executor: CommandExecutor<T>,
): Promise<ImplementationExecutionResult<T>> {
  const workflow = checkImplementationContext(context);
  if (!workflow.allowed) {
    return { status: 'workflow-blocked', missingPrerequisites: workflow.missingPrerequisites };
  }

  return executeCommand(command, executor);
}
