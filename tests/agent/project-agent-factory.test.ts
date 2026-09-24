import { createShellProjectCheckExecutor } from '../../src/agent/adapters/shell/project-check-executor.js';
import { OutputGuardrailTripwireTriggered } from '@openai/agents';
import { ScriptedModel, assistantMessage, functionCall } from '@openai/agents/testing';
import { describe, expect, it, vi } from 'vitest';
import { createProjectAgent, runProjectAgent } from '../../src/agent/adapters/openai/agents/project-agent-factory.js';

describe('project agent SDK integration', () => {
  it('runs a check with local context and accepts its confirmed claim', async () => {
    const output = {
      status: 'completed', summary: 'Tests passed.',
      verification: { testsPassed: true, lintPassed: false, typecheckPassed: false },
    };
    const model = new ScriptedModel([
      [functionCall('run_project_check', { action: 'test' }, { callId: 'test_1' })],
      [assistantMessage(JSON.stringify(output))],
    ]);
    const executor = vi.fn(async () => 'Tests passed');

    const result = await runProjectAgent(createProjectAgent(createShellProjectCheckExecutor(executor), model), 'Check the project');

    expect(result.finalOutput).toEqual(output);
    expect(executor).toHaveBeenCalledExactlyOnceWith('npm test');
    model.assertComplete();
  });

  it('invokes the native final output guardrail for unsupported claims', async () => {
    const model = new ScriptedModel([
      [assistantMessage(JSON.stringify({
        status: 'completed', summary: 'Tests passed.',
        verification: { testsPassed: true, lintPassed: false, typecheckPassed: false },
      }))],
    ]);
    const executor = vi.fn(async () => 'unused');

    await expect(runProjectAgent(createProjectAgent(createShellProjectCheckExecutor(executor), model), 'Check the project'))
      .rejects.toBeInstanceOf(OutputGuardrailTripwireTriggered);
    expect(executor).not.toHaveBeenCalled();
    model.assertComplete();
  });
});
