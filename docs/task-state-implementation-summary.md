# Task state implementation summary

## Scope

This iteration adds an SDK-independent operational task snapshot: requirements,
implementation plan, human approval, and persistence. The issue remains the source
of product requirements; TaskState retains a requirements snapshot so restoring a
task does not need GitHub access or chat history. Issue synchronization is manual.

TaskState is separate from PersistedAgentRun. Existing SDK approval/resume behavior
and tool configuration are unchanged. Task readiness is available to application
callers; it is not yet wired into the implementation executor or an orchestrator.

## Modules

Paths below are relative to `src/agent/`:

| Module | Responsibility |
| --- | --- |
| `domain/task-state.ts` | Task source, requirements, plan, approval, and versioned snapshot types |
| `application/task-state.ts` | Explicit snapshot operations with caller-supplied IDs and timestamps |
| `policies/task-readiness-policy.ts` | Deterministic approval and implementation readiness decisions |
| `ports/task-store.ts` | SDK-independent `save` and `load` contract |
| `adapters/persistence/file-task-store.ts` | Runtime validation and atomic JSON replacement |

## State and operations

`schemaVersion: 1` identifies the persisted format. `revision` identifies the whole
task snapshot; requirements and plan each have their own revision. All revisions
start at 1 and advance on their corresponding operations. The first plan has
revision 1. Each operation returns a new snapshot without mutating its input.

- `createTask(input, timestamp)` stores the source and requirements with no plan or
  approval. GitHub sources use an issue URL; manual sources may have a null reference.
- `updateRequirements(task, requirements, timestamp)` increments the requirements
  and task revisions, retains the old plan as outdated, and clears approval.
- `setPlan(task, plan, timestamp)` increments the plan and task revisions, binds the
  plan to the current requirements revision, and clears approval. Replacing a plan
  with identical steps still requires fresh approval.
- `approvePlan(task, timestamp)` binds approval to the current plan and requirements
  revisions and increments the task revision. Call it at the application boundary
  only after the user approves that snapshot. No model-facing approval tool is added.

Timestamps are UTC ISO strings, supplied by the caller for deterministic behavior.
`createdAt` stays unchanged; updates set `updatedAt` to the supplied timestamp.

Approval requires a nonblank requirements description, nonempty acceptance
criteria, no open questions, and a current plan with implementation and verification
steps. Blank entries do not satisfy criteria or step requirements. An invalid
approval attempt throws with the blocking reason codes.

`getPlanApprovalReadiness(task)` checks those prerequisites.
`getTaskReadiness(task)` also requires approval matching the current revisions.
Readiness is computed, never persisted. Its ordered `reasons` can contain:

`requirements_missing`, `acceptance_criteria_missing`, `open_questions`,
`plan_missing`, `plan_outdated`, `plan_steps_missing`,
`verification_steps_missing`, `approval_missing`, `approval_outdated`.

Plan approval does not replace SDK approval of an individual tool call.

## Persistence and compatibility

Construct `FileTaskStore` with a private directory outside source control. Each task
uses `<taskId>.json`; IDs allow only ASCII letters, digits, underscores, and hyphens.
There is no default directory or automatic deletion after agent-run completion.

Saving validates the complete snapshot before writing a private temporary file
with mode `0600`, then renames it over the previous snapshot and cleans up the
temporary file. Loading validates field types, timestamps, positive safe-integer
revisions, source references, and revision relationships. Outdated plans without
approval are valid persisted state; inconsistent approval references are rejected.

A missing task returns `null`. Invalid JSON, invalid state, unknown schema versions,
and ID mismatches throw explicit errors. Other filesystem failures propagate.
Unknown schema versions are not migrated or silently replaced.

Version 1 assumes one writer per task. The revision field is not a lock or a
compare-and-swap mechanism. Atomic replacement does not provide power-loss recovery
or exactly-once execution. Callers retain task snapshots independently of SDK run
cleanup.

## Verification coverage

`tests/agent/task-state.test.ts` covers initial readiness, versioned approval,
requirements and plan changes, blocked approval, stale approvals, and snapshot
immutability. `tests/agent/file-task-store.test.ts` covers round trips through fresh
stores and a separate Node process, readiness after restore and requirements
changes, private file permissions, replacement, missing tasks, malformed state,
unknown schemas, ID mismatch, path traversal, and filesystem errors.

Run `npm test`, `npm run typecheck`, and `npm run lint` for validation.

Workflow stages, handoffs, review findings, code-version-bound verification,
concurrent writers, migrations, and recovery orchestration remain later iterations.
