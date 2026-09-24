import { beforeEach, describe, expect, it, vi } from 'vitest';
import { realExecutor } from '../../src/agent/adapters/shell/project-command-executor.js';
import { createShellProjectCheckExecutor } from '../../src/agent/adapters/shell/project-check-executor.js';

const { runProcess } = vi.hoisted(() => ({ runProcess: vi.fn() }));
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  // Match execFile's native promisify contract without spawning a process.
  return { execFile: Object.assign(vi.fn(), { [promisify.custom]: runProcess }) };
});

beforeEach(() => { runProcess.mockReset(); });

describe('shell adapter', () => {
  it.each([
    ['test', 'npm', ['test']],
    ['lint', 'npm', ['run', 'lint']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['git_status', 'git', ['status', '--short']],
    ['git_diff', 'git', ['diff']],
  ] as const)('executes %s with separate program and arguments', async (action, program, args) => {
    runProcess.mockResolvedValue({ stdout: ' output ', stderr: 'warning\n' });
    const execute = createShellProjectCheckExecutor(realExecutor);
    await expect(execute(action)).resolves.toEqual({
      status: 'executed', result: 'output \nwarning',
    });
    expect(runProcess).toHaveBeenCalledExactlyOnceWith(program, args, { cwd: process.cwd() });
  });

  it('preserves process failures', async () => {
    const error = new Error('process failed');
    runProcess.mockRejectedValue(error);
    await expect(createShellProjectCheckExecutor(realExecutor)('test')).rejects.toBe(error);
  });

  it('rejects commands outside the fixed mapping without spawning', async () => {
    await expect(realExecutor('echo unsupported')).rejects.toThrow(
      'No executable mapping for command: echo unsupported',
    );
    expect(runProcess).not.toHaveBeenCalled();
  });
});
