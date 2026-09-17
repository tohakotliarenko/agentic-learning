import { describe, expect, it, vi } from 'vitest';
import { executeCommand } from '../src/command-executor.js';

describe('executeCommand', () => {
  it.each(['git status', 'git diff', 'npm test', 'npm run lint', 'npm run typecheck'])(
    'executes allowed command %j exactly once',
    async (command) => {
      const output = { exitCode: 0, stdout: 'done' };
      const executor = vi.fn(() => output);

      const pending = executeCommand(command, executor);
      expect(pending).toBeInstanceOf(Promise);
      const result = await pending;

      expect(executor).toHaveBeenCalledExactlyOnceWith(command);
      expect(result.status).toBe('executed');
      if (result.status === 'executed') {
        expect(result.result).toBe(output);
      }
    },
  );

  it('awaits an asynchronous executor and preserves the original command', async () => {
    const command = '  git\t status  &&  git diff  ';
    const output = { stdout: 'done' };
    let finish: (value: typeof output) => void = () => {
      throw new Error('Executor result was not initialized');
    };
    const execution = new Promise<typeof output>((resolve) => {
      finish = resolve;
    });
    const executor = vi.fn(() => execution);
    const pending = executeCommand(command, executor);
    let settled = false;
    void pending.then(() => { settled = true; });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(executor).toHaveBeenCalledExactlyOnceWith(command);

    finish(output);
    const result = await pending;
    expect(result.status).toBe('executed');
    if (result.status === 'executed') {
      expect(result.result).toBe(output);
    }
  });

  it.each([
    ['git reset --hard', 'git reset --hard is blocked.'],
    ['git clean -fd', 'git clean -fd is blocked.'],
    ['git checkout -- .', 'git checkout -- . is blocked.'],
    ['git restore .', 'git restore . is blocked.'],
    ['git push origin main --force', 'Force pushing is blocked.'],
    ['git push -f', 'Force pushing is blocked.'],
    ['rm -rf tmp', 'rm -rf and rm -fr are blocked.'],
    ['rm -fr tmp', 'rm -rf and rm -fr are blocked.'],
    ['', 'Command is empty.'],
    [' \t\n ', 'Command is empty.'],
    ['git status && rm -rf tmp', 'rm -rf and rm -fr are blocked.'],
    ['npm test; git push origin main -f', 'Force pushing is blocked.'],
    ['git clean -fd | cat', 'git clean -fd is blocked.'],
  ])('never calls the executor for %j', async (command, reason) => {
    const executor = vi.fn(() => { throw new Error('Must not execute'); });

    const pending = executeCommand(command, executor);
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).resolves.toEqual({ status: 'blocked', reason });
    expect(executor).not.toHaveBeenCalled();
  });

  it('propagates a synchronous executor error unchanged as a rejection', async () => {
    const error = new Error('Execution failed');
    const executor = vi.fn(() => { throw error; });

    await expect(executeCommand('npm test', executor)).rejects.toBe(error);
    expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
  });

  it('propagates an asynchronous executor rejection unchanged', async () => {
    const error = new Error('Async execution failed');
    const executor = vi.fn(() => Promise.reject(error));

    await expect(executeCommand('npm test', executor)).rejects.toBe(error);
    expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
  });
});
