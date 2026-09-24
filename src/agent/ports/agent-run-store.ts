import type { PersistedAgentRun } from '../domain/persisted-agent-run.js';

export interface AgentRunStore {
  save(runId: string, run: PersistedAgentRun): Promise<void>;
  load(runId: string): Promise<PersistedAgentRun | null>;
  delete(runId: string): Promise<void>;
}
