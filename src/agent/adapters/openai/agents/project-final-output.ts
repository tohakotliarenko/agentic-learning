import { z } from 'zod';

export const projectFinalOutput = z.strictObject({
  status: z.enum(['completed', 'blocked', 'needs_input']),
  summary: z.string(),
  verification: z.strictObject({
    testsPassed: z.boolean(),
    lintPassed: z.boolean(),
    typecheckPassed: z.boolean(),
  }),
});

