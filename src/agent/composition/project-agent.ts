import { realExecutor } from '../adapters/shell/project-command-executor.js';
import { createShellProjectCheckExecutor } from '../adapters/shell/project-check-executor.js';
import { createProjectAgent, runProjectAgent } from '../adapters/openai/agents/project-agent-factory.js';

const agent = createProjectAgent(createShellProjectCheckExecutor(realExecutor));

async function main() {
  const result = await runProjectAgent(
    agent,
    'Check whether this project is currently healthy. Run the relevant checks and summarize the result.',
  );

  console.log(result.finalOutput);
}

main().catch(console.error);
