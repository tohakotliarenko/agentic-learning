import { afterEach, describe, expect, it, vi } from 'vitest';
import * as commandExecutor from '../src/command-executor.js';
import * as commandPolicy from '../src/command-policy.js';
import { executeImplementationCommand } from '../src/implementation-executor.js';
import type { ImplementationContext } from '../src/workflow-policy.js';

const context: ImplementationContext = {
  hasActiveTask: true,
  hasCurrentRequirements: true,
  ambiguitiesResolved: true,
  hasImplementationPlan: true,
  planExplicitlyApproved: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeImplementationCommand', () => {
  it.each(['npm test', 'git status && rm -rf tmp', ''])(
    'returns missing prerequisites without evaluating command %j',
    async (command) => {
      const executionSpy = vi.spyOn(commandExecutor, 'executeCommand');
      const policySpy = vi.spyOn(commandPolicy, 'checkCommand');
      const executor = vi.fn(() => { throw new Error('Must not execute'); });

      await expect(executeImplementationCommand(
        { ...context, hasActiveTask: false, planExplicitlyApproved: false },
        command,
        executor,
      )).resolves.toEqual({
        status: 'workflow-blocked',
        missingPrerequisites: ['hasActiveTask', 'planExplicitlyApproved'],
      });

      expect(executionSpy).not.toHaveBeenCalled();
      expect(policySpy).not.toHaveBeenCalled();
      expect(executor).not.toHaveBeenCalled();
    },
  );

  it('preserves the command-policy blocked result with a valid workflow', async () => {
    const executor = vi.fn(() => 'unused');

    await expect(executeImplementationCommand(
      context, 'git status && rm -rf tmp', executor,
    )).resolves.toEqual({ status: 'blocked', reason: 'rm -rf and rm -fr are blocked.' });
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves executor output (asynchronous: %j)', async (asyncResult) => {
    const command = '  git\t status  ';
    const output = { exitCode: 0, stdout: 'done' };
    const executor = vi.fn(() => asyncResult ? Promise.resolve(output) : output);
    const executionSpy = vi.spyOn(commandExecutor, 'executeCommand');

    const result = await executeImplementationCommand(context, command, executor);

    expect(executionSpy).toHaveBeenCalledExactlyOnceWith(command, executor);
    expect(executor).toHaveBeenCalledExactlyOnceWith(command);
    expect(result.status).toBe('executed');
    if (result.status === 'executed') {
      expect(result.result).toBe(output);
    }
    expect(result).toBe(await executionSpy.mock.results[0]?.value);
  });

  it.each([false, true])('propagates executor errors (asynchronous: %j)', async (asyncError) => {
    const error = new Error('Execution failed');
    const executor = vi.fn(() => {
      if (asyncError) {
        return Promise.reject(error);
      }
      throw error;
    });

    await expect(executeImplementationCommand(context, 'npm test', executor)).rejects.toBe(error);
    expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
  });
});
