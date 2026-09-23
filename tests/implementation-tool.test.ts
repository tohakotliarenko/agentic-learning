import { Agent, Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { describe, expect, it, vi } from 'vitest';
import { createImplementationTool } from '../src/implementation-tool.js';
import { checkImplementationContext, type ImplementationContext } from '../src/workflow-policy.js';

const ready: ImplementationContext = {
  hasActiveTask: true,
  hasCurrentRequirements: true,
  ambiguitiesResolved: true,
  hasImplementationPlan: true,
};

function implementationScenario(
  context: ImplementationContext,
  input: Record<string, unknown>,
  executor: (task: string) => Promise<string> | string,
) {
  const model = new ScriptedModel([
    [functionCall('implement_task', input, { callId: 'implementation_1' })],
    [assistantMessage('Done.')],
  ]);
  const agent = new Agent({
    name: 'Implementation test agent',
    model,
    tools: [createImplementationTool(context, executor)],
  });
  const runner = new Runner({ tracingDisabled: true });
  return { model, agent, runner };
}

async function requestImplementation(
  context: ImplementationContext,
  input: Record<string, unknown>,
  executor: (task: string) => Promise<string> | string,
) {
  const { model, agent, runner } = implementationScenario(context, input, executor);
  let result = await runner.run(agent, 'Implement the task.');
  if (result.interruptions.length > 0) {
    for (const interruption of result.interruptions) {
      result.state.approve(interruption);
    }
    result = await runner.run(agent, result.state);
  }
  model.assertComplete();
  return { result, model };
}

describe('implementation tool approval', () => {
  it('resumes after user rejection without calling the executor', async () => {
    const executor = vi.fn(async () => 'Implemented');
    const { model, agent, runner } = implementationScenario(ready, { task: 'Add a feature' }, executor);
    const result = await runner.run(agent, 'Implement the task.');

    expect(result.interruptions).toHaveLength(1);
    expect(executor).not.toHaveBeenCalled();
    const interruption = result.interruptions[0];
    if (!interruption) throw new Error('Expected an approval interruption');
    const message = 'Implementation was rejected by the user';
    result.state.reject(interruption, { message });

    const resumed = await runner.run(agent, result.state);

    expect(executor).not.toHaveBeenCalled();
    expect(resumed.finalOutput).toBeDefined();
    expect(resumed.interruptions).toHaveLength(0);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function_call_result', output: { type: 'text', text: message },
      }),
    ]));
    model.assertComplete();
  });

  it('interrupts a valid request without calling the executor', async () => {
    const executor = vi.fn(() => 'Implemented');
    const { model, agent, runner } = implementationScenario(ready, { task: 'Add a feature' }, executor);

    const result = await runner.run(agent, 'Implement the task.');

    expect(result.interruptions).toHaveLength(1);
    expect(result.interruptions[0]?.rawItem).toMatchObject({
      name: 'implement_task',
      arguments: JSON.stringify({ task: 'Add a feature' }),
    });
    expect(executor).not.toHaveBeenCalled();
    expect(model.calls).toHaveLength(1);
    // The final scripted model turn is intentionally unconsumed while paused.
  });

  it('executes exactly once after approval and resuming the interrupted state', async () => {
    const task = '  Add a feature  ';
    const executor = vi.fn(async () => 'Implemented');
    const { model, agent, runner } = implementationScenario(ready, { task }, executor);
    const interrupted = await runner.run(agent, 'Implement the task.');

    expect(interrupted.interruptions).toHaveLength(1);
    expect(executor).not.toHaveBeenCalled();
    const approval = interrupted.interruptions[0];
    if (!approval) throw new Error('Expected an approval interruption');
    interrupted.state.approve(approval);
    expect(executor).not.toHaveBeenCalled();

    const resumed = await runner.run(agent, interrupted.state);

    expect(executor).toHaveBeenCalledExactlyOnceWith(task);
    expect(resumed.interruptions).toHaveLength(0);
    expect(resumed.finalOutput).toBe('Done.');
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function_call_result', output: { type: 'text', text: 'Implemented' },
      }),
    ]));
    model.assertComplete();
  });
});

describe('implementation tool input guardrail', () => {
  it.each([
    { ...ready, hasCurrentRequirements: false },
    { ...ready, hasActiveTask: false, ambiguitiesResolved: false, hasImplementationPlan: false },
  ])('rejects a valid task when workflow is blocked: %j', async (context) => {
    const policy = checkImplementationContext(context);
    expect(policy.allowed).toBe(false);
    if (policy.allowed) throw new Error('Expected a blocked fixture');
    const before = { ...context };
    Object.freeze(context);
    const executor = vi.fn(() => 'must not execute');
    const { result, model } = await requestImplementation(context, { task: 'Add a feature' }, executor);
    const message = `Implementation blocked. Missing prerequisites: ${policy.missingPrerequisites.join(', ')}.`;

    expect(executor).not.toHaveBeenCalled();
    expect(context).toEqual(before);
    expect(result.toolInputGuardrailResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        output: expect.objectContaining({ behavior: { type: 'rejectContent', message } }),
      }),
    ]));
    expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function_call_result', output: { type: 'text', text: message },
      }),
    ]));
  });

  it.each([false, true])('executes a valid task once (async executor: %j)', async (asyncExecutor) => {
    const task = '  Add a feature  ';
    const executor = vi.fn(() => asyncExecutor ? Promise.resolve('Implemented') : 'Implemented');
    const { result, model } = await requestImplementation(ready, { task }, executor);

    expect(executor).toHaveBeenCalledExactlyOnceWith(task);
    expect(result.toolInputGuardrailResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ output: expect.objectContaining({ behavior: { type: 'allow' } }) }),
    ]));
    expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function_call_result', output: { type: 'text', text: 'Implemented' },
      }),
    ]));
  });

  // The SDK may invoke input guardrails for invalid input; execution must still be prevented.
  it.each([{}, { task: '' }, { task: 42 }, { task: 'Add a feature', extra: true }])(
    'rejects invalid schema input %j without executing',
    async (input) => {
      const executor = vi.fn(() => 'must not execute');
      const { result } = await requestImplementation(ready, input, executor);

      expect(executor).not.toHaveBeenCalled();
      const outputs = result.newItems.filter((item) => item.type === 'tool_call_output_item');
      expect(outputs).toHaveLength(1);
      expect(outputs[0]?.output).toEqual(expect.stringContaining('Invalid JSON input for tool'));
    },
  );
});
