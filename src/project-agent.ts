import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectCommands } from './project-check-tool.js';
import { createProjectAgent, runProjectAgent } from './project-agent-factory.js';

const execFileAsync = promisify(execFile);

async function realExecutor(command: string): Promise<string> {
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

const agent = createProjectAgent(realExecutor);

async function main() {
  const result = await runProjectAgent(
    agent,
    'Check whether this project is currently healthy. Run the relevant checks and summarize the result.',
  );

  console.log(result.finalOutput);
}

main().catch(console.error);
