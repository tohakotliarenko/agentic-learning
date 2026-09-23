import type { OutputGuardrail } from '@openai/agents';
import { z } from 'zod';
import { unsupportedVerificationClaims, type VerificationState } from './verification-policy.js';

export const projectFinalOutput = z.strictObject({
  status: z.enum(['completed', 'blocked', 'needs_input']),
  summary: z.string(),
  verification: z.strictObject({
    testsPassed: z.boolean(),
    lintPassed: z.boolean(),
    typecheckPassed: z.boolean(),
  }),
});

export const verificationOutputGuardrail: OutputGuardrail<
  typeof projectFinalOutput, VerificationState
> = {
  name: 'verification_claims',
  execute: async ({ agentOutput, context }) => {
    const unsupported = unsupportedVerificationClaims(agentOutput.verification, context.context);
    return { tripwireTriggered: unsupported.length > 0, outputInfo: { unsupported } };
  },
};
