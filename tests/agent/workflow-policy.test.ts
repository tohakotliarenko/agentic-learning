import { describe, expect, it } from 'vitest';
import { checkImplementationContext } from '../../src/agent/policies/workflow-policy.js';
import type { ImplementationContext, ImplementationPrerequisite } from '../../src/agent/domain/implementation-context.js';

const completeContext: ImplementationContext = {
  hasActiveTask: true,
  hasCurrentRequirements: true,
  ambiguitiesResolved: true,
  hasImplementationPlan: true,
};

describe('checkImplementationContext', () => {
  const cases: { name: string; missing: ImplementationPrerequisite[] }[] = [
    { name: 'all prerequisites present', missing: [] },
    { name: 'active task missing', missing: ['hasActiveTask'] },
    { name: 'current requirements missing', missing: ['hasCurrentRequirements'] },
    { name: 'ambiguities unresolved', missing: ['ambiguitiesResolved'] },
    { name: 'implementation plan missing', missing: ['hasImplementationPlan'] },
    {
      name: 'several prerequisites missing',
      missing: ['hasActiveTask', 'ambiguitiesResolved'],
    },
    {
      name: 'all prerequisites missing',
      missing: [
        'hasActiveTask',
        'hasCurrentRequirements',
        'ambiguitiesResolved',
        'hasImplementationPlan',
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
      hasImplementationPlan: false,
      ambiguitiesResolved: true,
      hasCurrentRequirements: true,
      hasActiveTask: false,
    };

    expect(checkImplementationContext(context)).toEqual({
      allowed: false,
      missingPrerequisites: ['hasActiveTask', 'hasImplementationPlan'],
    });
  });

  it.each([true, false])('does not mutate input when plan availability is %j', (hasImplementationPlan) => {
    const context = Object.freeze({ ...completeContext, hasImplementationPlan });
    const before = { ...context };

    const first = checkImplementationContext(context);
    expect(checkImplementationContext(context)).toEqual(first);
    expect(context).toEqual(before);
  });
});
