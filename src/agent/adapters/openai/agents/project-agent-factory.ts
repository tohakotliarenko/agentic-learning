import { Agent, Runner, type Model } from '@openai/agents';
import { createProjectCheckTool } from '../tools/project-check-tool.js';
import type { ProjectCheckExecutor, ImplementationCapability } from '../../../ports/executors.js';
import { createVerificationState, type VerificationState } from '../../../domain/verification-state.js';
import { projectFinalOutput } from './project-final-output.js';
import { verificationOutputGuardrail } from '../guardrails/verification-output-guardrail.js';

export function createProjectAgent<T, U = never>(
  executor: ProjectCheckExecutor<T>,
  model: string | Model = 'gpt-5.6-luna',
  implementation?: ImplementationCapability<U>,
) {
  return new Agent<VerificationState, typeof projectFinalOutput>({
    name: 'Project Verification Agent',
    model,
    instructions: `You inspect the health of the current TypeScript project.
Use the available tool for real verification. Report a verification field as true
only when the latest execution of that check passed in this run. Report false
for checks that were not run or failed. Do not claim git state is clean without
running the relevant tool. Return the required structured final output.`,
    tools: [createProjectCheckTool(executor, implementation)],
    outputType: projectFinalOutput,
    outputGuardrails: [verificationOutputGuardrail],
  });
}

export function runProjectAgent(
  agent: ReturnType<typeof createProjectAgent>,
  input: string,
  runner = new Runner({ tracingDisabled: true }),
) {
  // Each run owns its state; never expose it via prompts or tool output.
  return runner.run(agent, input, { context: createVerificationState() });
}
