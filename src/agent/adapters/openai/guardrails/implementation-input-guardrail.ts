import {
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';
import { checkImplementationContext } from '../../../policies/workflow-policy.js';
import type { ImplementationContext } from '../../../domain/implementation-context.js';

export function createImplementationInputGuardrail(context: ImplementationContext) {
  return defineToolInputGuardrail({
    name: 'implementation_prerequisites',
    run: async () => {
      const policy = checkImplementationContext(context);
      if (!policy.allowed) {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          `Implementation blocked. Missing prerequisites: ${policy.missingPrerequisites.join(', ')}.`,
        );
      }
      return ToolGuardrailFunctionOutputFactory.allow();
    },
  });
}
