import {
  defineToolOutputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';

// Exercise-only substring policy: case-sensitive, with no recursive object scan.
export const projectOutputGuardrail = defineToolOutputGuardrail({
  name: 'project_sensitive_output',
  run: async ({ output }) => {
    const content =
      typeof output === 'object' && output !== null &&
      'status' in output && output.status === 'executed' && 'result' in output
        ? output.result
        : output;

    if (typeof content === 'string' &&
      (content.includes('sk-') || content.includes('OPENAI_API_KEY='))) {
      return ToolGuardrailFunctionOutputFactory.rejectContent(
        'Tool output rejected: sensitive content detected.',
      );
    }

    return ToolGuardrailFunctionOutputFactory.allow();
  },
});
