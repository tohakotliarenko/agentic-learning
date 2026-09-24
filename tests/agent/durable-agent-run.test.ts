import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectAgent } from '../../src/agent/adapters/openai/agents/project-agent-factory.js';
import { createDurableProjectAgent } from '../../src/agent/composition/durable-project-agent.js';
import { FileAgentRunStore } from '../../src/agent/adapters/persistence/file-agent-run-store.js';

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'durable-agent-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

const ready = {
  hasActiveTask: true, hasCurrentRequirements: true,
  ambiguitiesResolved: true, hasImplementationPlan: true,
};
const finalOutput = {
  status: 'completed', summary: 'Finished.',
  verification: { testsPassed: true, lintPassed: false, typecheckPassed: false },
};

// Only plain identifiers escape this scope, never the initial SDK state/runtime.
async function startInterrupted() {
  const executor = vi.fn(() => 'must wait');
  const model = new ScriptedModel([
    [functionCall('run_project_check', { action: 'test' }, { callId: 'check_1' })],
    [functionCall('run_project_check', { action: 'implement', task: 'Add a feature' }, { callId: 'implement_1' })],
  ]);
  const agent = createProjectAgent(
    () => ({ status: 'executed', result: 'Tests passed' }), model,
    { context: ready, executor },
  );
  const result = await createDurableProjectAgent(directory, agent).start('Check and implement.');
  expect(result.status).toBe('waiting_for_approval');
  expect(executor).not.toHaveBeenCalled();
  if (result.status !== 'waiting_for_approval') throw new Error('Expected interruption');
  expect(result.pending).toEqual([{
    callId: 'implement_1', toolName: 'run_project_check',
    arguments: JSON.stringify({ action: 'implement', task: 'Add a feature' }),
  }]);
  expect(await new FileAgentRunStore(directory).load(result.runId)).not.toBeNull();
  model.assertComplete();
  const pending = result.pending[0];
  if (!pending) throw new Error('Expected pending approval');
  return { runId: result.runId, callId: pending.callId };
}

function restartedRuntime(model: ScriptedModel, executor: (task: string) => string) {
  const agent = createProjectAgent(
    () => { throw new Error('Checks must not be replayed'); }, model,
    { context: { ...ready }, executor },
  );
  return createDurableProjectAgent(directory, agent);
}

describe('durable approval across runtimes', () => {
  it.each(['approve', 'reject'] as const)('%s after disk restore', async (type) => {
    const { runId, callId } = await startInterrupted();
    const executor = vi.fn(() => 'Implemented');
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(finalOutput))]]);
    const runtime = restartedRuntime(model, executor);

    const result = await runtime.resume(runId, callId, type === 'approve'
      ? { type } : { type, message: 'Implementation was rejected by the user' });

    expect(result).toEqual({ status: 'completed', runId, finalOutput });
    if (type === 'approve') {
      expect(executor).toHaveBeenCalledExactlyOnceWith('Add a feature');
    } else {
      expect(executor).not.toHaveBeenCalled();
      expect(JSON.stringify(model.calls[0]?.request.input)).toContain('Implementation was rejected by the user');
    }
    // The true testsPassed claim also proves local verification context survived restore.
    expect(await new FileAgentRunStore(directory).load(runId)).toBeNull();
    model.assertComplete();
  });

  it('completes a run without an approval snapshot when no tool needs approval', async () => {
    const output = { ...finalOutput, verification: {
      testsPassed: false, lintPassed: false, typecheckPassed: false,
    } };
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(output))]]);
    const executor = vi.fn(() => 'unused');
    const result = await restartedRuntime(model, executor).start('Report without implementation');
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') throw new Error('Expected completion');
    expect(result.finalOutput).toEqual(output);
    expect(await new FileAgentRunStore(directory).load(result.runId)).toBeNull();
    expect(executor).not.toHaveBeenCalled();
    model.assertComplete();
  });

  it('persists another interruption with the same run ID', async () => {
    const { runId, callId } = await startInterrupted();
    const executor = vi.fn(() => 'Implemented');
    const model = new ScriptedModel([
      [functionCall('run_project_check', { action: 'implement', task: 'Next feature' }, { callId: 'implement_2' })],
    ]);
    const result = await restartedRuntime(model, executor).resume(runId, callId, { type: 'approve' });
    expect(result.status).toBe('waiting_for_approval');
    expect(result.runId).toBe(runId);
    expect(executor).toHaveBeenCalledExactlyOnceWith('Add a feature');
    const finalModel = new ScriptedModel([[assistantMessage(JSON.stringify(finalOutput))]]);
    await restartedRuntime(finalModel, executor).resume(runId, 'implement_2', { type: 'approve' });
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenLastCalledWith('Next feature');
    model.assertComplete();
    finalModel.assertComplete();
  });

  it('fails on missing runs and unknown interruptions without executing', async () => {
    const executor = vi.fn(() => 'must not run');
    const runtime = restartedRuntime(new ScriptedModel([]), executor);
    await expect(runtime.resume('missing', 'call', { type: 'approve' })).rejects.toThrow('Agent run not found');
    const { runId } = await startInterrupted();
    await expect(runtime.resume(runId, 'unknown', { type: 'approve' })).rejects.toThrow('Pending approval not found');
    expect(executor).not.toHaveBeenCalled();
    expect(await new FileAgentRunStore(directory).load(runId)).not.toBeNull();
  });

  it('does not start a new run when SDK state is malformed', async () => {
    const store = new FileAgentRunStore(directory);
    await store.save('broken', {
      version: 1, runId: 'broken', status: 'waiting_for_approval', serializedState: '{}',
    });
    const executor = vi.fn(() => 'must not run');
    const model = new ScriptedModel([]);
    await expect(restartedRuntime(model, executor).resume('broken', 'call', { type: 'approve' }))
      .rejects.toThrow('schema version');
    expect(executor).not.toHaveBeenCalled();
    expect(model.calls).toHaveLength(0);
  });
});
