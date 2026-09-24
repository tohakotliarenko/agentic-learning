import type { ProjectCheckAction } from '../domain/project-action.js';
import type { CommandExecutionResult } from '../domain/command-execution-result.js';
import type { ImplementationContext } from '../domain/implementation-context.js';

export type CommandExecutor<T> = (command: string) => Promise<T> | T;
export type ProjectCheckExecutor<T> = (action: ProjectCheckAction) =>
  Promise<CommandExecutionResult<T>> | CommandExecutionResult<T>;
export type ImplementationExecutor<T> = (task: string) => Promise<T> | T;

export interface ImplementationCapability<T> {
  context: ImplementationContext;
  executor: ImplementationExecutor<T>;
}
