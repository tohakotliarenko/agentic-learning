# Project

This is a TypeScript/Node.js project.

The codebase should remain simple, explicit, maintainable, and easy to test.
Prefer established project patterns over introducing new abstractions or technologies.

Before making changes, inspect the relevant existing code and understand how the affected behavior currently works.

---

## Working Principles

- Keep changes focused on the requested task.
- Prefer the smallest change that fully solves the problem.
- Do not refactor unrelated code.
- Do not rename, move, or reformat unrelated files.
- Prefer existing abstractions and patterns over introducing new ones.
- Do not create abstractions for hypothetical future requirements.
- Avoid clever solutions when a simple implementation is sufficient.
- Preserve existing public behavior unless the task explicitly changes it.
- Do not silently fix unrelated problems discovered while working.

If you discover an unrelated problem that appears important, mention it in the final summary instead of changing it.

---

## Requirements and Ambiguity

Do not invent externally observable product behavior.

Ask for clarification before implementation when ambiguity affects:

- public API behavior
- user-visible behavior
- persisted data
- data deletion
- permissions or authorization
- security
- backward compatibility
- error behavior that callers may depend on
- important business rules

Examples of questions that should usually be clarified:

- What should happen when a requested resource does not exist?
- Should an operation return a value or throw an error?
- Is an operation idempotent?
- Should existing callers observe different behavior?
- Should data be deleted permanently or retained?
- Who is allowed to perform an operation?

Do not ask for clarification about ordinary implementation details when a reasonable engineering decision can be made safely.

Examples that normally do not require clarification:

- local variable names
- private helper structure
- equivalent TypeScript syntax
- internal implementation details that do not affect observable behavior

When requirements are incomplete but implementation can safely proceed without committing to product behavior, proceed and clearly state the assumption.

---

## Architecture

Respect the existing architecture and module boundaries.

Before introducing a new architectural pattern:

1. Search the codebase for an existing solution to the same type of problem.
2. Prefer the existing pattern when it is reasonable.
3. Introduce a new abstraction only when the current task clearly benefits from it.

Do not move business logic into unrelated layers for convenience.

Avoid creating generic utilities, base classes, factories, repositories, or other abstractions unless there is a concrete current need.

Do not perform large architectural changes as part of a feature or bug fix unless explicitly requested.

---

### Sources of Requirements

For each task, distinguish between:

- repository-wide rules in `AGENTS.md`
- task or ticket requirements
- acceptance criteria
- existing documented behavior
- user clarifications made during implementation

Do not silently resolve contradictions between these sources.

Treat explicit user clarifications as additions to the task requirements unless they conflict with an existing requirement.

If they conflict, ask whether the existing requirement should be overridden.

Once an override is explicitly confirmed, treat the confirmed behavior as the current requirement for the remainder of the task.

---

## Task Context

A task or ticket is considered active only when the user explicitly identifies it or provides its content.

When a task references an external ticket by ID or URL:

1. Retrieve the ticket using an available connected tool.
2. Read the full description and acceptance criteria before implementation.
3. Treat the ticket as the baseline task requirements.
4. Include relevant clarifications from the conversation.
5. Before completing the task, verify the final implementation against the ticket requirements.

Do not guess which ticket is active based only on branch names, recent files, or issue history.

---

## TypeScript

- Keep TypeScript strict.
- Do not weaken compiler settings to make code compile.
- Avoid `any` unless integration with an untyped external API makes it genuinely necessary.
- Prefer `unknown` over `any` when a value must be validated or narrowed.
- Prefer explicit domain types where they improve correctness.
- Avoid unnecessary type assertions.
- Do not use `@ts-ignore` or `@ts-expect-error` without a clear reason.
- Prefer narrowing and correct types over suppressing compiler errors.
- Keep public interfaces intentional and minimal.

When modifying an existing API, consider whether the type change can affect existing callers.

---

## Error Handling

Do not silently swallow errors.

- Preserve useful error context.
- Do not catch an error unless the code can handle it meaningfully, add useful context, or perform necessary cleanup.
- Do not use exceptions as normal control flow when a simpler representation is appropriate.
- Follow existing project conventions for expected failures.
- Do not expose sensitive implementation details through user-facing errors.

When changing error behavior that callers may observe, treat it as product/API behavior and clarify ambiguous requirements first.

---

## Dependencies

Do not add dependencies unless they are necessary for the requested task.

Before adding a dependency:

1. Check whether the functionality already exists in the project.
2. Check whether the platform or standard library provides a reasonable solution.
3. Prefer a small local implementation for trivial functionality.

Do not:

- upgrade unrelated dependencies
- change dependency versions merely to remove warnings
- replace libraries without being asked
- run destructive automatic dependency fixes
- run commands such as `npm audit fix --force` without explicit approval

If a dependency or runtime warning is discovered but is unrelated to the task, report it instead of expanding the scope.

---

## Security

Treat authentication, authorization, secrets, personal data, and destructive operations as security-sensitive.

Never:

- commit credentials, tokens, API keys, or secrets
- log credentials or sensitive personal data
- disable authorization checks to make tests pass
- weaken security validation without explicit requirements
- expose internal errors or secrets to clients

Do not read or modify `.env`, credential files, private keys, or secret stores unless the task explicitly requires it.

If a requested change appears to create a security vulnerability, stop and explain the concern before implementing it.

---

## Data and Destructive Operations

Be conservative with operations that can destroy or irreversibly modify data.

Do not automatically:

- delete production data
- reset databases
- drop tables
- truncate data
- rewrite migrations that may already have been deployed
- run destructive migration commands

If a command may have destructive consequences and its safety is unclear, ask before running it.

---

## Generated and Vendor Code

Do not manually edit generated files unless the task explicitly requires it.

When generated output needs to change:

1. Find the source that generates it.
2. Modify the source.
3. Use the project's generation command.

Do not modify vendored third-party code unless explicitly requested.

If generated or vendor directories are not obvious, inspect project configuration before editing them.

---

## Testing

Behavior changes should normally be covered by tests.

When fixing a bug:

1. Understand the root cause.
2. When practical, reproduce the bug with a failing test.
3. Implement the smallest appropriate fix.
4. Confirm the test now passes.
5. Run relevant regression tests.

When implementing a feature:

- test the intended public behavior
- cover meaningful edge cases
- avoid tests that only reproduce implementation details
- avoid excessive tests for trivial static behavior
- follow existing testing patterns

Never:

- delete or weaken a valid test merely to make the suite pass
- change expected values without understanding why behavior changed
- mock the code under test in a way that makes the test meaningless

Prefer focused tests first, then broader verification when appropriate.

---

## Commands

Use the package manager already configured by the repository.

Do not introduce or switch package managers as part of an unrelated task.

Typical project commands:

Install dependencies:

    npm install

Run tests:

    npm test

Run lint:

    npm run lint

Run TypeScript checks:

    npm run typecheck

If the actual scripts in `package.json` differ from these examples, use the project's real scripts.

Before running expensive or broad commands, check whether a more focused command can validate the affected code.

---

## Verification

Do not consider an implementation complete immediately after editing the code.

After making changes:

1. Run the most relevant tests.
2. Run type checking.
3. Run linting.
4. Inspect the final diff.
5. Check for unintended or unrelated changes.
6. Verify that the implementation satisfies the original request.

Run broader tests when the change has a broad impact.

If a verification command fails:

- determine whether the failure was caused by your changes
- fix failures caused by your changes
- do not modify unrelated code merely to make unrelated existing failures disappear
- report unrelated pre-existing failures clearly

Do not claim that tests, lint, builds, or type checks passed unless they were actually run successfully.

---

## Scope Control

Stay within the scope of the requested task.

Do not opportunistically:

- refactor neighboring modules
- reformat unrelated files
- rename unrelated symbols
- upgrade dependencies
- fix unrelated warnings
- rewrite tests that are not relevant
- modernize legacy code
- change public APIs

If additional work would materially improve the solution, mention it separately rather than silently including it.

A task that reveals a larger architectural problem should not automatically become an architectural rewrite.

---

## Legacy Code

Existing code is not automatically a recommended pattern.

Before copying an existing pattern, consider whether the surrounding code or documentation identifies it as legacy.

Do not modernize legacy code unless:

- the requested change requires it, or
- leaving it unchanged would make the requested implementation unsafe or impractical

When touching legacy code, minimize the affected surface area.

If the project contains explicitly documented preferred and legacy approaches, use the preferred approach for new code.

---

## Comments and Documentation

Prefer code that explains itself through clear naming and structure.

Add comments when they explain:

- why a non-obvious decision exists
- an important constraint
- unusual external behavior
- a workaround that would otherwise look unnecessary

Do not add comments that merely restate the code.

Update relevant documentation when a change affects documented public behavior, setup, or developer workflows.

Do not create large documentation files unless requested.

---

## Git

Treat the working tree as user-owned state.

Before making changes, inspect existing modifications when relevant.

Do not overwrite or revert changes that you did not create.

Never run destructive Git commands such as:

    git reset --hard
    git clean -fd
    git checkout -- .
    git restore .

unless explicitly requested and the consequences are understood.

Do not:

- commit unless explicitly asked
- push unless explicitly asked
- force push
- rewrite existing commits
- delete branches
- change Git configuration

Before completing a task, inspect the final diff.

Keep changes limited to files relevant to the task.

---

## External Systems and Tools

Treat actions against external systems differently from local inspection.

Reading information from an external tool may be safe, while modifying external state may not be.

Do not perform external side effects such as:

- merging pull requests
- closing issues
- modifying tickets
- deploying applications
- changing cloud infrastructure
- sending messages
- changing production data

unless the task explicitly authorizes that action.

When an external action is irreversible, destructive, security-sensitive, or difficult to undo, confirm intent first.

---

## Investigation

Do not immediately modify code when the task is primarily diagnostic.

For bugs and unexpected behavior:

1. Inspect the relevant code.
2. Trace the execution path.
3. Reproduce the problem when practical.
4. Identify the likely root cause.
5. Check whether the issue affects related paths.
6. Then implement a fix if implementation was requested.

Distinguish symptoms from root causes.

Do not make speculative fixes without evidence when the problem can reasonably be investigated first.

---

## Working With Existing Changes

The repository may contain uncommitted work from the user or another agent.

Do not assume existing modifications belong to the current task.

When existing changes overlap with files needed for the task:

- inspect them carefully
- preserve user changes
- avoid reverting them
- ask for clarification if ownership or intent is ambiguous

Do not clean the working tree simply because unrelated modifications exist.

---

## Completion Report

At the end of an implementation task, provide a concise summary containing:

1. What changed.
2. Important implementation decisions.
3. Verification actually performed.
4. Any unresolved issues, assumptions, or relevant warnings.

Do not report routine file reads or commands unless they are relevant.

Do not say the task is fully verified when some relevant checks could not be run.

---

## Definition of Done

A task is complete when:

- the requested behavior is implemented
- important ambiguity has been resolved rather than guessed
- the change is scoped to the task
- relevant tests exist and pass
- type checking passes when applicable
- linting passes when applicable
- the final diff has been reviewed
- no unrelated user changes were overwritten
- relevant limitations or warnings are reported

Correctness and maintainability are more important than maximizing the amount of code changed.