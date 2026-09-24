import { describe, expect, it } from 'vitest';
import { hasSensitiveOutput } from '../../src/agent/policies/project-output-policy.js';

describe('plain output policy', () => {
  it.each(['sk-example', 'prefix OPENAI_API_KEY=example'])('rejects %j', (value) => {
    expect(hasSensitiveOutput(value)).toBe(true);
  });

  it.each(['normal output', 'SK-example', '', null, 42, { result: 'sk-example' }])(
    'does not unwrap or recursively inspect %j', (value) => {
      expect(hasSensitiveOutput(value)).toBe(false);
    },
  );
});
