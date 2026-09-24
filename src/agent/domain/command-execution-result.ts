export type CommandExecutionResult<T> =
  | { status: 'blocked'; reason: string }
  | { status: 'executed'; result: T };

