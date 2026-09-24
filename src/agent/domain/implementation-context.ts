export interface ImplementationContext {
  readonly hasActiveTask: boolean;
  readonly hasCurrentRequirements: boolean;
  readonly ambiguitiesResolved: boolean;
  readonly hasImplementationPlan: boolean;
}

export type ImplementationPrerequisite = keyof ImplementationContext;

