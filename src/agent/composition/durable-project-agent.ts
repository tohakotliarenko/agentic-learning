import { FileAgentRunStore } from '../adapters/persistence/file-agent-run-store.js';
import { DurableAgentRun } from '../adapters/openai/agents/durable-agent-run.js';
import { createProjectAgent } from '../adapters/openai/agents/project-agent-factory.js';

// Callers recreate the configured agent and its executors in each runtime.
export function createDurableProjectAgent(
  directory: string,
  agent: ReturnType<typeof createProjectAgent>,
) {
  return new DurableAgentRun(agent, new FileAgentRunStore(directory));
}
