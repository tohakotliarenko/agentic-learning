import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileAgentRunStore } from '../../src/agent/adapters/persistence/file-agent-run-store.js';
import type { PersistedAgentRun } from '../../src/agent/domain/persisted-agent-run.js';

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'agent-store-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

const snapshot: PersistedAgentRun = {
  version: 1, runId: 'run-1', status: 'waiting_for_approval', serializedState: 'opaque SDK data',
};

describe('FileAgentRunStore', () => {
  it('saves and loads through a new store instance', async () => {
    await new FileAgentRunStore(directory).save(snapshot.runId, snapshot);
    expect(await new FileAgentRunStore(directory).load(snapshot.runId)).toEqual(snapshot);
  });

  it('overwrites the same run and leaves no temporary files', async () => {
    const store = new FileAgentRunStore(directory);
    await store.save(snapshot.runId, snapshot);
    const updated = { ...snapshot, serializedState: 'updated state' };
    await store.save(snapshot.runId, updated);
    expect(await store.load(snapshot.runId)).toEqual(updated);
    expect(await readdir(directory)).toEqual(['run-1.json']);
  });

  it('returns null for a missing run', async () => {
    expect(await new FileAgentRunStore(directory).load('missing')).toBeNull();
  });

  it('deletes completed state and tolerates missing cleanup', async () => {
    const store = new FileAgentRunStore(directory);
    await store.save(snapshot.runId, snapshot);
    await store.delete(snapshot.runId);
    await store.delete(snapshot.runId);
    expect(await store.load(snapshot.runId)).toBeNull();
  });

  it.each(['{', '{}', JSON.stringify({ ...snapshot, version: 2 }),
    JSON.stringify({ ...snapshot, runId: 'different' }),
    JSON.stringify({ ...snapshot, serializedState: 42 }),
  ])('fails clearly on malformed persisted data: %s', async (content) => {
    await writeFile(join(directory, 'run-1.json'), content);
    await expect(new FileAgentRunStore(directory).load('run-1')).rejects.toThrow('Invalid persisted agent run');
  });

  it('rejects invalid IDs on every operation', async () => {
    const store = new FileAgentRunStore(directory);
    await expect(store.save('../escape', snapshot)).rejects.toThrow('Invalid agent run ID');
    await expect(store.load('../escape')).rejects.toThrow('Invalid agent run ID');
    await expect(store.delete('../escape')).rejects.toThrow('Invalid agent run ID');
  });
});
