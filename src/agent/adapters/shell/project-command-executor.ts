import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectCommands } from './project-check-executor.js';

const execFileAsync = promisify(execFile);

export async function realExecutor(command: string): Promise<string> {
  const entry = Object.entries(projectCommands).find(
    ([, [program, args]]) => [program, ...args].join(' ') === command,
  );

  if (!entry) {
    throw new Error(`No executable mapping for command: ${command}`);
  }

  const [, [program, args]] = entry;

  const { stdout, stderr } = await execFileAsync(program, [...args], {
    cwd: process.cwd(),
  });

  return [stdout, stderr].filter(Boolean).join('\n').trim();
}

