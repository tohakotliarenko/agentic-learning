import {
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';
import { checkImplementationContext, type ImplementationContext } from './workflow-policy.js';

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
