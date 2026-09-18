# Agent workflows learning project

A small TypeScript Node.js project with strict type checking, Vitest, and ESLint.
No AI functionality or external storage.

`.nvmrc` and `.node-version` select Node.js `24.21.0`. Use `nvm install` and
`nvm use` with nvm, or enable your version manager's automatic directory switching.
The package supports `^24.21.0` (newer Node 24 minor and patch releases); the
version files select the exact version rather than automatically upgrading it.

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

Put local secrets in the project-root `.env` file (ignored by Git). Run TypeScript
files with `npm run exec -- src/your-file.ts`; dotenv loads `.env` before the file
runs, making values available through `process.env`. `npm test` also preloads
dotenv. Existing environment variables take precedence over `.env` values.
This sets variables in the Node process, not in your parent terminal session.

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

`src/implementation-executor.ts` exports the asynchronous
`executeImplementationCommand(context, command, executor)` composition layer.
It checks workflow prerequisites first. A blocked workflow returns
`{ status: 'workflow-blocked', missingPrerequisites }` without evaluating command
policy or calling the executor. Otherwise, it delegates to `executeCommand` and
preserves its `{ status: 'blocked', reason }` or `{ status: 'executed', result }`
result. Synchronous throws and asynchronous executor rejections propagate.

This layer inherits the workflow policy's reliance on caller-supplied facts and
the command policy's lexical limitations; it adds no security boundary or shell
runner. Tests live in `tests/implementation-executor.test.ts`.

The project agent uses `createProjectCheckTool(executor)` from
`src/project-check-tool.ts`. Its `run_project_check` input accepts only an `action`:
`test` → `npm test`, `lint` → `npm run lint`, `typecheck` → `npm run typecheck`,
`git_status` → `git status --short`, or `git_diff` → `git diff`.
The strict schema rejects unsupported actions and extra fields, including raw
`command` fields. Mapped commands pass through `executeCommand` before reaching
the injected executor. The CLI uses the shared mapping with `execFile`.

Agent tests use this production factory with a scripted model and injected
callbacks, with tracing disabled; they make no live API calls or shell executions.

`src/project-output-guardrail.ts` defines a native SDK tool output guardrail on
`run_project_check`. After execution, it checks string output (including the
string `result` in the executed-result envelope) for case-sensitive `sk-` or
`OPENAI_API_KEY=` substrings. The SDK's `rejectContent` behavior replaces rejected
output with a fixed, non-sensitive message before the next model turn. Normal
output is allowed unchanged; the executor's result is not modified before the
guardrail evaluates it. This exercise policy does not recursively scan objects
or detect every kind of secret. Agent-level tests use synthetic values and inspect
the next scripted model request with tracing disabled.

`src/implementation-tool.ts` exports `createImplementationTool(context, executor)`.
Its `implement_task` function tool accepts only `{ task: string }` with a non-empty
string, passed unchanged to the injected executor. The native input guardrail in
`src/implementation-input-guardrail.ts` calls `checkImplementationContext(context)`
on each invocation. A blocked workflow uses SDK `rejectContent` with the complete
missing-prerequisite list returned by the policy; it does not execute the request
or invent or change workflow state. An allowed workflow runs the executor once.

Schema validation checks input shape only. The SDK may invoke input guardrails
even for invalid input, but invalid input never reaches the executor. This demo
adds no shell runner or extra validation layer. Scripted agent tests in
`tests/implementation-tool.test.ts` disable tracing and use injected callbacks.
