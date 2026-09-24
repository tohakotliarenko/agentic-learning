# Architecture

The project separates the application from its development tooling:

```text
src/
  app/       # Application code: UserService and User
  agent/     # Development agent and its internal layers
tests/
  app/       # Application tests
  agent/     # Development agent tests
```

The application does not depend on the development agent. Agent tooling operates
on the project through its injected executors.

Inside `src/agent/`, the framework follows inward source dependencies:

```text
domain <- policies <- application <- adapters
   ^                       |
   +-------- ports <-------+
composition -> concrete adapters
```

Arrows point from an importing module toward its dependency. Layers may import
deeper layers directly; they do not have to route every call through each layer.
Runtime callbacks can invoke adapters through ports without importing their
implementations.

## Where code belongs

The following layer paths are relative to `src/agent/`.

- **domain/**: implementation context, verification state/claims, action types,
  and execution result types. No SDK, process, or adapter dependencies.
- **policies/**: deterministic decisions over plain data. Command matching,
  workflow prerequisites, sensitive output, and verification claims live here.
  Policies may import domain; they do not execute commands or import SDK code.
- **ports/**: executor callback contracts and implementation capability configuration.
  Contracts depend only on domain, not concrete adapters.
- **application/**: SDK-independent orchestration through ports, including command
  policy enforcement, workflow-first command execution, and verification updates.
  It may import domain, policies, and ports. Project checks work with semantic
  actions, never npm/git mappings.
- **adapters/shell/**: action-to-command mapping and actual execFile integration.
  The action executor delegates policy enforcement to application/command-executor.
  Only this adapter imports child_process; it does not import OpenAI adapters.
- **adapters/openai/agents/**: Agent/Runner configuration, structured output schema,
  and fresh local context for each run.
- **adapters/openai/tools/**: strict input schemas, conditional approval, SDK context
  translation, and delegation to application functions/injected executors.
- **adapters/openai/guardrails/**: native SDK guardrails. They translate SDK data
  and policy decisions into allow, rejectContent, or output tripwire results.
- **composition/**: executable entry point that wires shell and OpenAI adapters.
  It contains no policies.

Outside these layers, **src/app/** contains UserService and User. Storage remains
an instance-local Map.

Do not import adapters from domain, policies, ports, or application.
Keep OpenAI types out of the core. Do not import the shell adapter from an OpenAI
adapter: composition supplies a ProjectCheckExecutor. No DI container is needed.

## Project check execution

1. Composition wraps the command executor with createShellProjectCheckExecutor
   and supplies the resulting action executor to createProjectAgent.
2. runProjectAgent creates independent verification state with every check not_run.
   SDK RunContext stores it locally; it is not inserted into prompts.
3. The tool validates a fixed action. Checks require no human approval.
4. executeProjectCheck passes the action to its injected port. The shell adapter
   maps it to a fixed command and calls executeCommand, which checks command policy
   before the underlying executor can run.
5. The shell process adapter uses execFile with separate program/arguments and the
   current working directory. Output formatting and error propagation are unchanged.
6. An executed result sets the corresponding check to passed. A throw/rejection
   sets it to failed and propagates the same error. A policy block preserves state.
   Later successful checks can replace failed state; git actions change no flags.
7. The native output guardrail unwraps an executed-result envelope and passes its
   plain content to the sensitive-output policy. That policy does not understand
   envelopes or recursively scan objects. Rejection affects disclosure, not
   verification success.
8. The final agent output guardrail rejects unsupported true verification claims
   against local state. False claims are valid for checks that were not run.

The lexical command policy remains an exercise, not a general shell security
boundary. No policy rules or SDK guardrail ordering are redesigned by this layout.

## Implementation execution

The optional implement capability requires a task and human approval through the
SDK's conditional needsApproval callback. Approval/resume permits the native input
guardrail to consult workflow policy; it does not override missing prerequisites.
Rejection or blocked prerequisites leave the implementation executor uncalled.
Ordinary checks are independent of implementation readiness.

The implementation executor receives task text unchanged, not a shell command.
Implementation results also pass through the native sensitive-output guardrail
and do not update verification state. Invalid input cannot reach an executor;
SDK guardrails may still run for invalid input.

A separate application/implementation-executor use case still checks workflow
first and then delegates a raw command to executeCommand. It is not the SDK
implement path and does not provide human approval. Both existing paths are
intentionally retained.

## Running and testing

Run the CLI with:

```sh
npm run exec -- src/agent/composition/project-agent.ts
```

The CLI configures checks only, without an implementation executor. It retains
its existing model, prompt, dotenv launcher, output format, and error handling.

Application tests live in tests/app/; agent tests live in tests/agent/.
Agent tests use ScriptedModel with tracing disabled and
inject shell command callbacks; process adapter tests mock execFile. Verification
does not require live API calls or real shell side effects.

After changes run npm test, npm run lint, and npm run typecheck. Review imports to
ensure core modules have no SDK/process dependencies and adapters remain decoupled.

## Durable human approval

The optional durable entry point is
`src/agent/composition/durable-project-agent.ts`. It accepts a configurable
snapshot directory and a configured project agent:

```ts
const runtime = createDurableProjectAgent(directory, agent);
const result = await runtime.start(input);
// When result.status === 'waiting_for_approval', retain runId and pending callId.

// In a later process, recreate the agent, executors, and runtime:
const resumed = await newRuntime.resume(runId, callId, { type: 'approve' });
// Or: { type: 'reject', message: 'Implementation was rejected by the user' }
```

Lifecycle:

```text
running -> waiting_for_approval -> persisted -> restored
        -> approved/rejected -> running -> completed
```

A later interruption updates the snapshot under the same runId. The start/resume
operation returns waiting_for_approval only after saving has completed. Successful
completion removes the snapshot. Missing runs, invalid snapshots, and unknown
pending call IDs fail explicitly; they never silently start a new run.

- **Durable application state:** a versioned envelope in domain/persisted-agent-run
  containing the stable runId, waiting status, and an opaque serializedState string.
  ports/agent-run-store exposes save/load/delete without SDK types.
- **OpenAI SDK state:** adapters/openai/agents/durable-agent-run uses
  RunState.toString() and RunState.fromString(agent, serializedState).
  History, approvals, and local verification context are restored by the SDK.
  Approval/rejection uses the actual item returned by restored.getInterruptions().
  Resume calls Runner.run with that state, without resetting verification.
- **Persistence adapter:** FileAgentRunStore validates the envelope and reads/writes
  JSON in the configured directory. It writes a private temporary file and renames
  it over the previous snapshot. The OpenAI adapter leaves SDK payload validation
  and schema-version compatibility to the SDK.

Each process must recreate the compatible agent/tool configuration, implementation
workflow context, and executor callbacks. These executable dependencies are not
serialized. Existing approval and workflow policies still apply after restore.
The existing verification-only CLI remains unchanged.

Snapshots can contain run inputs, tool history, and context: use a private directory
outside source control. The SDK's default serialization omits tracing API keys;
tracing remains disabled by the durable runner.

This is restart persistence, not exactly-once execution or power-loss recovery.
There are no retries, locks, concurrent-approval coordination, or idempotency
guarantees. A crash after a side effect but before the next save/cleanup can leave
an older snapshot. SDK-version migrations are not implemented.

Offline integration tests discard the initial runtime and retain only run/call
identifiers, then create a fresh store, agent, Runner, and ScriptedModel. Both
approve and reject paths read from temporary disk storage. Tests also verify
preserved verification state, another interruption under the same runId, and
malformed-state failures.
