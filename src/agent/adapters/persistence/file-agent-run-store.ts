import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentRunStore } from '../../ports/agent-run-store.js';
import type { PersistedAgentRun } from '../../domain/persisted-agent-run.js';

function validate(value: unknown, runId: string): asserts value is PersistedAgentRun {
  if (typeof value !== 'object' || value === null ||
    !('version' in value) || value.version !== 1 ||
    !('runId' in value) || value.runId !== runId ||
    !('status' in value) || value.status !== 'waiting_for_approval' ||
    !('serializedState' in value) || typeof value.serializedState !== 'string' ||
    value.serializedState.length === 0) {
    throw new Error('Invalid persisted agent run envelope.');
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export class FileAgentRunStore implements AgentRunStore {
  constructor(private readonly directory: string) {}

  private path(runId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('Invalid agent run ID.');
    return join(this.directory, runId + '.json');
  }

  async save(runId: string, run: PersistedAgentRun): Promise<void> {
    const path = this.path(runId);
    validate(run, runId);
    await mkdir(this.directory, { recursive: true });
    const temporary = path + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(run), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async load(runId: string): Promise<PersistedAgentRun | null> {
    const path = this.path(runId);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('Invalid persisted agent run JSON.');
    }
    validate(value, runId);
    return value;
  }

  async delete(runId: string): Promise<void> {
    await rm(this.path(runId), { force: true });
  }
}
