# Agent workflows learning project

A small TypeScript Node.js project with strict type checking, Vitest, and ESLint.
The application lives in `src/app/`; the development agent lives separately in
`src/agent/`. The application uses in-memory storage and does not depend on the agent.

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

`src/app/user-service.ts` exports `UserService`:

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

Unit tests live in `tests/app/user-service.test.ts`.

`src/agent/policies/command-policy.ts` exports the pure `checkCommand(command)` function. It never
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
`tests/agent/command-policy.test.ts`.

`src/agent/application/command-executor.ts` exports `executeCommand(command, executor)`. It checks
the policy before calling the injected executor. Blocked commands resolve to
`{ status: 'blocked', reason }` without invoking the executor. Allowed commands
reach the executor exactly once, with the original string unchanged.

The wrapper always returns a Promise and awaits synchronous or asynchronous
executor results, resolving to `{ status: 'executed', result }`. Executor throws
and rejections propagate as rejected Promises. There is no built-in shell runner
or `child_process` integration. The wrapper inherits the policy limitations above
and is not a security boundary. Tests use callbacks without running shell commands.

`src/agent/policies/workflow-policy.ts` exports the pure `checkImplementationContext(context)`
function, independent of command policy and execution. The `ImplementationContext` in `src/agent/domain/implementation-context.ts`
requires four caller-supplied booleans: `hasActiveTask`, `hasCurrentRequirements`,
`ambiguitiesResolved`, and `hasImplementationPlan`.

When all are true, it returns `{ allowed: true }`. Otherwise, it returns
`{ allowed: false, missingPrerequisites }`, listing every false field in the order
above. Human approval is handled separately by the SDK tool approval mechanism.
The function does not mutate input,
infer or create missing state, or verify that the supplied facts are true.
Table-driven tests live in `tests/agent/workflow-policy.test.ts`.

`src/agent/application/implementation-executor.ts` exports the asynchronous
`executeImplementationCommand(context, command, executor)` composition layer.
It checks workflow prerequisites first. A blocked workflow returns
`{ status: 'workflow-blocked', missingPrerequisites }` without evaluating command
policy or calling the executor. Otherwise, it delegates to `executeCommand` and
preserves its `{ status: 'blocked', reason }` or `{ status: 'executed', result }`
result. Synchronous throws and asynchronous executor rejections propagate.

This layer inherits the workflow policy's reliance on caller-supplied facts and
the command policy's lexical limitations; it adds no security boundary or shell
runner. Tests live in `tests/agent/implementation-executor.test.ts`.

The project agent uses `createProjectCheckTool(createShellProjectCheckExecutor(executor))` from
`src/agent/adapters/openai/tools/project-check-tool.ts`. Its `run_project_check` input accepts only an `action`:
`test` → `npm test`, `lint` → `npm run lint`, `typecheck` → `npm run typecheck`,
`git_status` → `git status --short`, or `git_diff` → `git diff`.
The strict schema rejects unsupported actions and extra fields, including raw
`command` fields. Mapped commands pass through `executeCommand` before reaching
the injected executor. The CLI uses the shared mapping with `execFile`.

Agent tests use this production factory with a scripted model and injected
callbacks, with tracing disabled; they make no live API calls or shell executions.

`src/agent/adapters/openai/guardrails/project-output-guardrail.ts` defines a native SDK tool output guardrail on
`run_project_check`. After execution, it checks string output (including the
string `result` in the executed-result envelope) for case-sensitive `sk-` or
`OPENAI_API_KEY=` substrings. The SDK's `rejectContent` behavior replaces rejected
output with a fixed, non-sensitive message before the next model turn. Normal
output is allowed unchanged; the executor's result is not modified before the
guardrail evaluates it. This exercise policy does not recursively scan objects
or detect every kind of secret. Agent-level tests use synthetic values and inspect
the next scripted model request with tracing disabled.

`createProjectCheckTool(createShellProjectCheckExecutor(checkExecutor), { context, executor: implementationExecutor })`
enables an additional `implement` capability on the same `run_project_check` tool.
Checks accept only `{ action }`; implementation requires
`{ action: 'implement', task: 'non-empty request' }`. Task text is passed unchanged
to the separate implementation executor, never interpreted as a shell command.
The verification-only CLI does not configure this capability. Applications can
supply it as the third argument to `createProjectAgent`.

Approval is conditional on parsed arguments: `action === 'implement'` pauses for
human approval; checks execute without an interruption. After approval and resume,
the implementation-only input guardrail delegates to `checkImplementationContext`.
Human approval does not override missing workflow prerequisites. Those prerequisites
do not block ordinary checks. Rejecting and resuming never invokes either executor
for that implementation request. Implementation does not update verification flags.
The native sensitive-output guardrail also covers implementation output.

The former standalone `createImplementationTool` has been replaced by this shared
factory. Schema validation still rejects unsupported actions, raw commands, extra
fields, missing or empty implementation tasks, and task fields on checks. The SDK
may invoke input guardrails even for invalid input, but execution remains blocked.
Tests in `tests/agent/implementation-tool.test.ts` cover both capability paths with
tracing disabled, scripted models, and injected callbacks only.

See [Architecture](docs/architecture.md) for layer boundaries and execution flows.
Run the agent with `npm run exec -- src/agent/composition/project-agent.ts`.
The OpenAI factories accept a semantic action executor; compose a command callback
with `createShellProjectCheckExecutor` from `src/agent/adapters/shell/project-check-executor.ts`.
