import { describe, expect, it } from 'vitest';
import {
  checkImplementationContext,
  type ImplementationContext,
  type ImplementationPrerequisite,
} from '../src/workflow-policy.js';

const completeContext: ImplementationContext = {
  hasActiveTask: true,
  hasCurrentRequirements: true,
  ambiguitiesResolved: true,
  hasImplementationPlan: true,
  planExplicitlyApproved: true,
};

describe('checkImplementationContext', () => {
  const cases: { name: string; missing: ImplementationPrerequisite[] }[] = [
    { name: 'all prerequisites present', missing: [] },
    { name: 'active task missing', missing: ['hasActiveTask'] },
    { name: 'current requirements missing', missing: ['hasCurrentRequirements'] },
    { name: 'ambiguities unresolved', missing: ['ambiguitiesResolved'] },
    { name: 'plan absent despite approval', missing: ['hasImplementationPlan'] },
    { name: 'explicit approval missing', missing: ['planExplicitlyApproved'] },
    {
      name: 'several prerequisites missing',
      missing: ['hasActiveTask', 'ambiguitiesResolved', 'planExplicitlyApproved'],
    },
    {
      name: 'all prerequisites missing',
      missing: [
        'hasActiveTask',
        'hasCurrentRequirements',
        'ambiguitiesResolved',
        'hasImplementationPlan',
        'planExplicitlyApproved',
      ],
    },
  ];

  it.each(cases)('$name', ({ missing }) => {
    const context = { ...completeContext };
    for (const key of missing) {
      context[key] = false;
    }

    expect(checkImplementationContext(context)).toEqual(
      missing.length === 0
        ? { allowed: true }
        : { allowed: false, missingPrerequisites: missing },
    );
  });

  it('reports missing prerequisites in fixed order regardless of property order', () => {
    const context: ImplementationContext = {
      planExplicitlyApproved: false,
      hasImplementationPlan: false,
      ambiguitiesResolved: true,
      hasCurrentRequirements: true,
      hasActiveTask: false,
    };

    expect(checkImplementationContext(context)).toEqual({
      allowed: false,
      missingPrerequisites: ['hasActiveTask', 'hasImplementationPlan', 'planExplicitlyApproved'],
    });
  });

  it.each([true, false])('does not mutate input when approval is %j', (approval) => {
    const context = Object.freeze({ ...completeContext, planExplicitlyApproved: approval });
    const before = { ...context };

    const first = checkImplementationContext(context);
    expect(checkImplementationContext(context)).toEqual(first);
    expect(context).toEqual(before);
  });
});
