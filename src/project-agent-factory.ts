import { Agent, Runner, type Model } from '@openai/agents';
import { createProjectCheckTool } from './project-check-tool.js';
import { createVerificationState, type VerificationState } from './verification-policy.js';
import { projectFinalOutput, verificationOutputGuardrail } from './verification-output-guardrail.js';

export function createProjectAgent<T>(
  executor: (command: string) => Promise<T> | T,
  model: string | Model = 'gpt-5.6-luna',
) {
  return new Agent<VerificationState, typeof projectFinalOutput>({
    name: 'Project Verification Agent',
    model,
    instructions: `You inspect the health of the current TypeScript project.
Use the available tool for real verification. Report a verification field as true
only when the latest execution of that check passed in this run. Report false
for checks that were not run or failed. Do not claim git state is clean without
running the relevant tool. Return the required structured final output.`,
    tools: [createProjectCheckTool(executor)],
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
