import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileTaskStore } from '../../src/agent/adapters/persistence/file-task-store.js';
import { approvePlan, createTask, setPlan, updateRequirements } from '../../src/agent/application/task-state.js';
import { getTaskReadiness } from '../../src/agent/policies/task-readiness-policy.js';

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'task-store-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

const timestamp = '2026-11-25T10:00:00.000Z';
const requirements = {
  description: 'Persist task state',
  acceptanceCriteria: ['Restore across processes'],
  openQuestions: [],
};
const snapshot = approvePlan(setPlan(createTask({
  taskId: 'task-1',
  source: { type: 'github_issue', reference: 'https://github.com/example/project/issues/1' },
  requirements,
}, timestamp), {
  steps: ['Implement TaskStore'], verificationSteps: ['Run tests'],
}, timestamp), timestamp);

describe('FileTaskStore', () => {
  it('restores the task and readiness through a new store', async () => {
    await new FileTaskStore(directory).save(snapshot);
    const restored = await new FileTaskStore(directory).load(snapshot.taskId);
    expect(restored).toEqual(snapshot);
    if (!restored) throw new Error('Expected persisted task');
    expect(getTaskReadiness(restored)).toEqual({ ready: true, reasons: [] });
  });

  it('restores in another process with no chat or SDK state and blocks after requirements change', async () => {
    await new FileTaskStore(directory).save(snapshot);
    const storeModule = new URL('../../src/agent/adapters/persistence/file-task-store.ts', import.meta.url).href;
    const policyModule = new URL('../../src/agent/policies/task-readiness-policy.ts', import.meta.url).href;
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--import', 'tsx', '--input-type=module', '--eval',
      `import { FileTaskStore } from ${JSON.stringify(storeModule)};
       import { getTaskReadiness } from ${JSON.stringify(policyModule)};
       const task = await new FileTaskStore(process.argv[1]).load(process.argv[2]);
       console.log(JSON.stringify({ task, readiness: getTaskReadiness(task) }));`,
      directory, snapshot.taskId,
    ]);
    expect(JSON.parse(stdout)).toEqual({ task: snapshot, readiness: { ready: true, reasons: [] } });

    const store = new FileTaskStore(directory);
    const restored = await store.load(snapshot.taskId);
    if (!restored) throw new Error('Expected persisted task');
    const changed = updateRequirements(restored, { ...requirements, description: 'Updated scope' }, timestamp);
    await store.save(changed);
    const reloaded = await new FileTaskStore(directory).load(snapshot.taskId);
    if (!reloaded) throw new Error('Expected updated task');
    expect(reloaded.plan).toEqual(snapshot.plan);
    expect(getTaskReadiness(reloaded)).toEqual({
      ready: false, reasons: ['plan_outdated', 'approval_missing'],
    });
  });

  it('overwrites a task atomically with private permissions and no temporary files left', async () => {
    const store = new FileTaskStore(join(directory, 'nested'));
    await store.save(snapshot);
    const changed = updateRequirements(snapshot, requirements, timestamp);
    await store.save(changed);
    expect(await store.load(snapshot.taskId)).toEqual(changed);
    expect(await readdir(join(directory, 'nested'))).toEqual(['task-1.json']);
    expect((await stat(join(directory, 'nested', 'task-1.json'))).mode & 0o777).toBe(0o600);
  });

  it('returns null for a missing task, including a missing directory', async () => {
    expect(await new FileTaskStore(join(directory, 'missing')).load('missing')).toBeNull();
  });

  it('preserves the saved snapshot when a new save fails validation', async () => {
    const store = new FileTaskStore(directory);
    await store.save(snapshot);
    await expect(store.save({ ...snapshot, revision: 0 })).rejects.toThrow('Invalid persisted task state');
    expect(await store.load(snapshot.taskId)).toEqual(snapshot);
    expect(await readdir(directory)).toEqual(['task-1.json']);
  });

  it.each([
    {},
    { ...snapshot, taskId: 'another-task' },
    { ...snapshot, requirements: { ...snapshot.requirements, acceptanceCriteria: [42] } },
    { ...snapshot, plan: { ...snapshot.plan, verificationSteps: 'npm test' } },
    { ...snapshot, approval: { ...snapshot.approval, planRevision: 2 } },
    { ...snapshot, approval: { ...snapshot.approval, requirementsRevision: 2 } },
    { ...snapshot, approval: { ...snapshot.approval, approvedAt: 'invalid' } },
    { ...snapshot, plan: { ...snapshot.plan, requirementsRevision: 2 } },
    { ...snapshot, requirements: { ...snapshot.requirements, revision: 0 } },
    { ...snapshot, revision: 1.5 },
    { ...snapshot, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...snapshot, updatedAt: 'yesterday' },
    { ...snapshot, source: { type: 'github_issue', reference: null } },
    { ...snapshot, source: { type: 'github_issue', reference: 'not a URL' } },
    { ...snapshot, plan: null },
  ])('rejects malformed or inconsistent persisted snapshots: %j', async (value) => {
    await writeFile(join(directory, 'task-1.json'), JSON.stringify(value));
    await expect(new FileTaskStore(directory).load('task-1')).rejects.toThrow('Invalid persisted task state');
  });

  it('reports invalid JSON with its cause', async () => {
    await writeFile(join(directory, 'task-1.json'), '{');
    await expect(new FileTaskStore(directory).load('task-1')).rejects.toThrow('Invalid persisted task state JSON');
  });

  it('rejects unknown schema versions on both read and write', async () => {
    const content = JSON.stringify({ ...snapshot, schemaVersion: 2 });
    await writeFile(join(directory, 'task-1.json'), content);
    const store = new FileTaskStore(directory);
    await expect(store.load('task-1')).rejects.toThrow('Unsupported task state schemaVersion');
    await expect(store.save(JSON.parse(content))).rejects.toThrow('Unsupported task state schemaVersion');
  });

  it.each(['../escape', '/absolute', 'nested/task', 'nested\\task', '..', ''])('rejects unsafe ID %j on read and write', async (taskId) => {
    const store = new FileTaskStore(directory);
    await expect(store.load(taskId)).rejects.toThrow('Invalid task ID');
    await expect(store.save({ ...snapshot, taskId })).rejects.toThrow('Invalid task ID');
  });

  it('propagates filesystem errors instead of treating them as missing state', async () => {
    const notDirectory = join(directory, 'file');
    await writeFile(notDirectory, 'not a directory');
    const store = new FileTaskStore(notDirectory);
    await expect(store.load(snapshot.taskId)).rejects.toThrow();
    await expect(store.save(snapshot)).rejects.toThrow();
  });
});
