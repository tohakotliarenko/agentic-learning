export interface ImplementationContext {
  readonly hasActiveTask: boolean;
  readonly hasCurrentRequirements: boolean;
  readonly ambiguitiesResolved: boolean;
  readonly hasImplementationPlan: boolean;
  readonly planExplicitlyApproved: boolean;
}

export type ImplementationPrerequisite = keyof ImplementationContext;

export type WorkflowPolicyResult =
  | { allowed: true }
  | { allowed: false; missingPrerequisites: ImplementationPrerequisite[] };

const prerequisites: readonly ImplementationPrerequisite[] = [
  'hasActiveTask',
  'hasCurrentRequirements',
  'ambiguitiesResolved',
  'hasImplementationPlan',
  'planExplicitlyApproved',
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
