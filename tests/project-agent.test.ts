import { Agent, Runner } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { describe, expect, it, vi } from 'vitest';
import { createProjectCheckTool } from '../src/project-check-tool.js';

async function callProjectTool(input: Record<string, unknown>, executor: (command: string) => Promise<string>) {
  const model = new ScriptedModel([
    [functionCall('run_project_check', input, { callId: 'call_1' })],
    [assistantMessage('Done.')],
  ]);
  const agent = new Agent({
    name: 'Project agent',
    model,
    tools: [createProjectCheckTool(executor)],
  });
  const result = await new Runner({ tracingDisabled: true }).run(agent, 'Run a project check.');
  model.assertComplete();
  return {
    outputs: result.newItems.filter((item) => item.type === 'tool_call_output_item'),
    model,
  };
}

describe('project agent action tool', () => {
  it.each([
    ['test', 'npm test'],
    ['lint', 'npm run lint'],
    ['typecheck', 'npm run typecheck'],
    ['git_status', 'git status --short'],
    ['git_diff', 'git diff'],
  ])('maps %s to %s through the production tool', async (action, command) => {
    const executor = vi.fn(async () => 'check output');
    const { outputs } = await callProjectTool({ action }, executor);

    expect(executor).toHaveBeenCalledExactlyOnceWith(command);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.output).toEqual({ status: 'executed', result: 'check output' });
  });

  it.each([
    { action: 'deploy' },
    { action: 'rm -rf tmp' },
    { command: 'rm -rf tmp' },
    { command: 'npm test' },
    { action: 'test', command: 'rm -rf tmp' },
    { action: 'test', extra: true },
    {},
  ])('rejects invalid input %j before execution', async (input) => {
    const executor = vi.fn(async () => 'must not run');
    const { outputs } = await callProjectTool(input, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.output).toEqual(expect.stringContaining('Invalid JSON input for tool'));
  });
});

describe('project tool output guardrail', () => {
  it('passes normal output unchanged to the next model turn', async () => {
    const output = '  Checks passed.\nNo errors.\n';
    const executor = vi.fn(async () => output);
    const { model } = await callProjectTool({ action: 'test' }, executor);

    expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function_call_result',
        output: { type: 'text', text: JSON.stringify({ status: 'executed', result: output }) },
      }),
    ]));
  });

  it.each(['prefix sk-synthetic-example suffix', 'OPENAI_API_KEY=synthetic-example'])(
    'rejects sensitive output %j after the executor runs',
    async (output) => {
      const executor = vi.fn(async () => output);
      const { model, outputs } = await callProjectTool({ action: 'test' }, executor);

      expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
      expect(model.calls).toHaveLength(2);
      const rejection = 'Tool output rejected: sensitive content detected.';
      expect(outputs[0]?.output).toBe(rejection);
      expect(model.calls[1]?.request.input).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call_result', output: { type: 'text', text: rejection },
        }),
      ]));
      expect(JSON.stringify(model.calls[1]?.request)).not.toContain(output);
    },
  );
});
