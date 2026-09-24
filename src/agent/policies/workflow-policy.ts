import type { ImplementationContext, ImplementationPrerequisite } from '../domain/implementation-context.js';

export type WorkflowPolicyResult =
  | { allowed: true }
  | { allowed: false; missingPrerequisites: ImplementationPrerequisite[] };

const prerequisites: readonly ImplementationPrerequisite[] = [
  'hasActiveTask',
  'hasCurrentRequirements',
  'ambiguitiesResolved',
  'hasImplementationPlan',
];

// Evaluates caller-supplied facts without verifying, inferring, or creating state.
export function checkImplementationContext(
  context: ImplementationContext,
): WorkflowPolicyResult {
  const missingPrerequisites = prerequisites.filter((key) => !context[key]);
  return missingPrerequisites.length === 0
    ? { allowed: true }
    : { allowed: false, missingPrerequisites };
}
