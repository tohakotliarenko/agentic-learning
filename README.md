# Agent workflows learning project

A small TypeScript Node.js project with strict type checking, Vitest, and ESLint.
No AI functionality or external storage.

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

`src/user-service.ts` exports `UserService`:

- `createUser(name, email)` stores and returns an immutable user with `active: true`. Duplicate emails throw an error, including for inactive users.
- `getUserByEmail(email)` returns the user (active or inactive) or `undefined` when no match exists.
- `deleteUser(email)` returns `true` when the user is deleted, or `false` when no match exists.
- `deactivateUser(email)` sets `active` to `false` without deleting the user. Returns `true` for any existing user, including one already inactive, or `false` for an unknown user.

Returned users are immutable snapshots. Retrieve the user again after deactivation
to see the updated state.

Email lookup, duplicate detection, deletion, and deactivation are case-insensitive. Returned
users preserve the email spelling supplied at creation. Inputs are not trimmed
or validated. Each service instance has its own in-memory storage,
which is lost when the instance is discarded or the process exits.

Unit tests live in `tests/user-service.test.ts`.

`src/command-policy.ts` exports the pure `checkCommand(command)` function. It never
executes the input. Results are `{ allowed: true }` or
`{ allowed: false, reason: string }`. Empty input is blocked.

The policy blocks `git reset --hard`, `git clean -fd`, `git checkout -- .`,
`git restore .`, `git push` with a `--force` or `-f` argument anywhere after
`push`, and `rm -rf` / `rm -fr`. Extra whitespace is tolerated. Compound commands
are checked in order; the first blocked operation supplies the reason.

This is a limited lexical check, not a shell parser or security boundary. It
splits on `;`, `&`, `|`, newlines, and parentheses without interpreting quotes,
escapes, substitutions, aliases, wrappers, or executable paths. It can reject
quoted examples and miss equivalent commands. An allowed result is not a safety
guarantee. Policy tests, including these limitations, live in
`tests/command-policy.test.ts`.

`src/command-executor.ts` exports `executeCommand(command, executor)`. It checks
the policy before calling the injected executor. Blocked commands resolve to
`{ status: 'blocked', reason }` without invoking the executor. Allowed commands
reach the executor exactly once, with the original string unchanged.

The wrapper always returns a Promise and awaits synchronous or asynchronous
executor results, resolving to `{ status: 'executed', result }`. Executor throws
and rejections propagate as rejected Promises. There is no built-in shell runner
or `child_process` integration. The wrapper inherits the policy limitations above
and is not a security boundary. Tests use callbacks without running shell commands.

`src/workflow-policy.ts` exports the pure `checkImplementationContext(context)`
function, independent of command policy and execution. Its `ImplementationContext`
requires five caller-supplied booleans: `hasActiveTask`, `hasCurrentRequirements`,
`ambiguitiesResolved`, `hasImplementationPlan`, and `planExplicitlyApproved`.

When all are true, it returns `{ allowed: true }`. Otherwise, it returns
`{ allowed: false, missingPrerequisites }`, listing every false field in the order
above. Approval does not imply a plan exists. The function does not mutate input,
infer or create missing state, or verify that the supplied facts are true.
Table-driven tests live in `tests/workflow-policy.test.ts`.
