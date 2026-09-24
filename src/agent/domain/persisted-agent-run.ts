export interface PersistedAgentRun {
  version: 1;
  runId: string;
  status: 'waiting_for_approval';
  serializedState: string;
}
