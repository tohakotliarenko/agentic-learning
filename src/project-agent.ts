import { Agent, run } from '@openai/agents';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createProjectCheckTool, projectCommands } from './project-check-tool.js';

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

const runProjectCheck = createProjectCheckTool(realExecutor);

const agent = new Agent({
  name: 'Project Verification Agent',

  model: 'gpt-5.6-luna',

  instructions: `
You inspect the health of the current TypeScript project.

Use the available tool when you need real verification.
Do not claim that tests, lint, typecheck, or git state are clean unless you
actually ran the corresponding tool.

You only have access to the approved project checks exposed through your tools.
`,

  tools: [runProjectCheck],
});

async function main() {
  const result = await run(
    agent,
    'Check whether this project is currently healthy. Run the relevant checks and summarize the result.',
  );

  console.log(result.finalOutput);
}

main().catch(console.error);
