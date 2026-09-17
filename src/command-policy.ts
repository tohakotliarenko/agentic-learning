export type CommandPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * A lexical check for the listed command forms, not a shell parser or security
 * boundary. Splits on ;, &, |, newlines, and parentheses, then on whitespace.
 * Quotes, escapes, substitutions, aliases, wrappers (such as sudo), executable
 * paths, and alternative option spellings are not interpreted. This can produce
 * false positives inside quoted text and miss equivalent shell operations.
 * An allowed result means only that none of these rules matched.
 */
export function checkCommand(command: string): CommandPolicyResult {
  if (!command.trim()) {
    return { allowed: false, reason: 'Command is empty.' };
  }

  for (const segment of command.split(/[;&|\r\n()]+/)) {
    const [program, operation, ...args] = segment.trim().split(/\s+/);
    let reason: string | undefined;

    if (program === 'git') {
      if (operation === 'reset' && args[0] === '--hard') {
        reason = 'git reset --hard is blocked.';
      } else if (operation === 'clean' && args[0] === '-fd') {
        reason = 'git clean -fd is blocked.';
      } else if (operation === 'checkout' && args[0] === '--' && args[1] === '.') {
        reason = 'git checkout -- . is blocked.';
      } else if (operation === 'restore' && args[0] === '.') {
        reason = 'git restore . is blocked.';
      } else if (operation === 'push' && args.some((arg) => arg === '--force' || arg === '-f')) {
        reason = 'Force pushing is blocked.';
      }
    } else if (program === 'rm' && (operation === '-rf' || operation === '-fr')) {
      reason = 'rm -rf and rm -fr are blocked.';
    }

    if (reason) {
      return { allowed: false, reason };
    }
  }

  return { allowed: true };
}
