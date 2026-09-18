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
  planExplicitlyApproved: true,
};

async function requestImplementation(
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
  const result = await new Runner({ tracingDisabled: true }).run(agent, 'Implement the task.');
  model.assertComplete();
  return { result, model };
}

describe('implementation tool input guardrail', () => {
  it.each([
    { ...ready, planExplicitlyApproved: false },
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
