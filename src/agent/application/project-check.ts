import type { ProjectCheckAction } from '../domain/project-action.js';
import type { VerificationState } from '../domain/verification-state.js';
import type { ProjectCheckExecutor } from '../ports/executors.js';

export async function executeProjectCheck<T>(
  action: ProjectCheckAction,
  state: VerificationState,
  executor: ProjectCheckExecutor<T>,
) {
  const check = action === 'test' ? 'testsPassed'
    : action === 'lint' ? 'lintPassed' : action === 'typecheck' ? 'typecheckPassed' : undefined;
  try {
    const result = await executor(action);
    // A policy block records no execution attempt.
    if (check && result.status === 'executed') state[check] = 'passed';
    return result;
  } catch (error) {
    if (check) state[check] = 'failed';
    throw error;
  }
}
