import { describe, expect, it } from 'vitest';
import { checkCommand } from '../src/command-policy.js';

describe('checkCommand', () => {
  it.each([
    'git status',
    'git diff',
    'npm test',
    'npm run lint',
    'npm run typecheck',
    '  git\t status  ',
    'git status && git diff; npm test || npm run lint | cat',
    'git push origin main',
    'git push --force-with-lease',
    'git clean -n',
    'git restore ./file.ts',
    'git checkout -- ./file.ts',
    'rm -r tmp',
    'echo git reset --hard',
  ])('allows %j', (command) => {
    expect(checkCommand(command)).toEqual({ allowed: true });
  });

  it.each([
    ['git reset --hard', 'git reset --hard is blocked.'],
    ['git reset --hard HEAD~1', 'git reset --hard is blocked.'],
    ['git clean -fd', 'git clean -fd is blocked.'],
    ['git checkout -- .', 'git checkout -- . is blocked.'],
    ['git restore .', 'git restore . is blocked.'],
    ['git push --force', 'Force pushing is blocked.'],
    ['git push -f', 'Force pushing is blocked.'],
    ['git push origin main --force', 'Force pushing is blocked.'],
    ['git push origin -f main', 'Force pushing is blocked.'],
    ['rm -rf tmp', 'rm -rf and rm -fr are blocked.'],
    ['rm -fr tmp', 'rm -rf and rm -fr are blocked.'],
    [' \tgit  checkout\t --   .  ', 'git checkout -- . is blocked.'],
  ])('blocks %j with a stable reason', (command, reason) => {
    expect(checkCommand(command)).toEqual({ allowed: false, reason });
  });

  it.each([';', '&&', '||', '|', '&', '\n', '\r\n'])(
    'blocks a whole compound command separated by %j',
    (separator) => {
      const blocked = { allowed: false, reason: 'rm -rf and rm -fr are blocked.' };
      expect(checkCommand(`git status ${separator} rm -rf tmp`)).toEqual(blocked);
      expect(checkCommand(`rm -fr tmp ${separator} npm test`)).toEqual(blocked);
    },
  );

  it('checks grouped commands and does not carry flags across command boundaries', () => {
    expect(checkCommand('git status && (git push origin main --force)')).toEqual({
      allowed: false, reason: 'Force pushing is blocked.',
    });
    expect(checkCommand('git push origin main; echo -f')).toEqual({ allowed: true });
  });

  it.each(['', ' ', '\t\r\n  '])('blocks empty input %j', (command) => {
    expect(checkCommand(command)).toEqual({ allowed: false, reason: 'Command is empty.' });
  });

  it('consistently returns the first blocked operation in command order', () => {
    const command = 'git status; git clean -fd && rm -rf tmp';
    const expected = { allowed: false, reason: 'git clean -fd is blocked.' };
    expect(checkCommand(command)).toEqual(expected);
    expect(checkCommand(command)).toEqual(expected);
  });

  // These examples document lexical limitations, not guarantees of shell safety.
  it('does not interpret quoted text or unwrap executable wrappers', () => {
    expect(checkCommand('echo "example; rm -rf tmp"')).toEqual({
      allowed: false, reason: 'rm -rf and rm -fr are blocked.',
    });
    expect(checkCommand('sudo rm -rf tmp')).toEqual({ allowed: true });
  });
});
