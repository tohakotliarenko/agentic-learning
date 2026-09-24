import type { OutputGuardrail } from '@openai/agents';
import type { VerificationState } from '../../../domain/verification-state.js';
import { unsupportedVerificationClaims } from '../../../policies/verification-policy.js';
import { projectFinalOutput } from '../agents/project-final-output.js';

export const verificationOutputGuardrail: OutputGuardrail<
  typeof projectFinalOutput, VerificationState
> = {
  name: 'verification_claims',
  execute: async ({ agentOutput, context }) => {
    const unsupported = unsupportedVerificationClaims(agentOutput.verification, context.context);
    return { tripwireTriggered: unsupported.length > 0, outputInfo: { unsupported } };
  },
};
