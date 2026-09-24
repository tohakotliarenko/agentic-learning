import {
  defineToolOutputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';

import { hasSensitiveOutput } from '../../../policies/project-output-policy.js';
export const projectOutputGuardrail = defineToolOutputGuardrail({
  name: 'project_sensitive_output',
  run: async ({ output }) => {
    const content =
      typeof output === 'object' && output !== null &&
      'status' in output && output.status === 'executed' && 'result' in output
        ? output.result
        : output;

    if (hasSensitiveOutput(content)) {
      return ToolGuardrailFunctionOutputFactory.rejectContent(
        'Tool output rejected: sensitive content detected.',
      );
    }

    return ToolGuardrailFunctionOutputFactory.allow();
  },
});
