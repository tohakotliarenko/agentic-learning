import { describe, expect, it, vi } from 'vitest';
import { executeProjectCheck } from '../../src/agent/application/project-check.js';
import { createVerificationState } from '../../src/agent/domain/verification-state.js';
import type { ProjectCheckAction } from '../../src/agent/domain/project-action.js';

describe('project check orchestration', () => {
  it.each([
    ['test', 'testsPassed'],
    ['lint', 'lintPassed'],
    ['typecheck', 'typecheckPassed'],
  ] as const)('tracks the latest %s execution and preserves errors', async (action, field) => {
    const state = createVerificationState();
    const result = { status: 'executed' as const, result: 'output' };
    const executor = vi.fn(() => result);
    expect(await executeProjectCheck(action, state, executor)).toBe(result);
    expect(executor).toHaveBeenCalledExactlyOnceWith(action);
    expect(state).toEqual({ ...createVerificationState(), [field]: 'passed' });

    const error = new Error('check failed');
    for (const fail of [
      () => { throw error; },
      () => Promise.reject(error),
    ]) {
      await expect(executeProjectCheck(action, state, fail)).rejects.toBe(error);
      expect(state[field]).toBe('failed');
    }

    await executeProjectCheck(action, state, executor);
    expect(state[field]).toBe('passed');
  });

  it('preserves prior state when execution is blocked', async () => {
    const state = createVerificationState();
    state.testsPassed = 'passed';
    const blocked = { status: 'blocked' as const, reason: 'blocked' };
    expect(await executeProjectCheck('test', state, () => blocked)).toBe(blocked);
    expect(state.testsPassed).toBe('passed');
  });

  it.each<ProjectCheckAction>(['git_status', 'git_diff'])('%s does not update verification', async (action) => {
    const state = createVerificationState();
    await executeProjectCheck(action, state, () => ({ status: 'executed', result: 'clean' }));
    expect(state).toEqual(createVerificationState());
  });

  it('creates independent run state', () => {
    const first = createVerificationState();
    first.testsPassed = 'passed';
    expect(createVerificationState().testsPassed).toBe('not_run');
  });
});
