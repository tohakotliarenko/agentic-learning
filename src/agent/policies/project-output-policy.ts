// Exercise-only substring policy: case-sensitive, with no recursive object scan.
export function hasSensitiveOutput(content: unknown): boolean {
  return typeof content === 'string' &&
    (content.includes('sk-') || content.includes('OPENAI_API_KEY='));
}
