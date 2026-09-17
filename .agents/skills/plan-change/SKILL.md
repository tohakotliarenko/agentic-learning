---
name: plan-change
description: Inspect a task, ticket, or requested change and produce a concrete implementation plan without modifying files. Use when the user asks to plan, assess an implementation approach, review how a change should be made, or wants a plan before coding.
---

# Plan Change

This skill is read-only by default.

Do not modify files, install dependencies, change configuration, commit, push, or perform other write actions while using this skill unless the user explicitly asks to proceed with implementation.

## 1. Understand the task

Identify:

- requested behavior
- acceptance criteria
- constraints
- relevant clarifications
- unresolved ambiguities

If the task references an external ticket or issue, retrieve and read it before planning.

Treat the ticket plus explicitly approved clarifications as the current requirement set.

## 2. Inspect the codebase

Inspect only the parts of the codebase relevant to the requested change.

Determine:

- current behavior
- relevant execution paths
- affected modules
- existing patterns that should be reused
- likely dependencies between components

Do not edit files.

## 3. Identify conflicts and ambiguity

Before proposing an implementation:

- compare the request with existing documented behavior
- identify missing product decisions
- identify conflicts with current requirements
- identify compatibility or migration risks

Ask for clarification when ambiguity affects externally observable behavior.

Do not invent missing product requirements.

## 4. Produce the implementation plan

The plan should include, when relevant:

1. Current behavior.
2. Intended behavior.
3. Files or modules likely to change.
4. Implementation approach.
5. Important data or API changes.
6. Edge cases.
7. Tests to add or update.
8. Verification commands.
9. Risks or compatibility concerns.
10. Open questions.

Prefer concrete file and symbol names when they can be identified reliably.

Avoid vague steps such as "update the code" or "add tests" without explaining what should change.

## 5. Scope check

Check whether the proposed change requires:

- unrelated refactoring
- dependency additions
- schema or migration changes
- public API changes
- security-sensitive changes
- destructive operations

Call these out explicitly rather than silently including them in the plan.

## 6. Stop after planning

Do not implement the plan.

End with a concise implementation plan and any unresolved questions.

Implementation requires a separate explicit instruction from the user.

## Publishing the plan

The implementation plan is read-only by default.

Do not publish, edit, or otherwise modify the external ticket while preparing the plan.

If the user explicitly asks to publish the approved plan:

1. Use the connected issue-tracking tool.
2. Post the plan as a comment on the source ticket.
3. Do not modify the original ticket description unless explicitly requested.
4. Preserve the distinction between:
   - original requirements
   - user clarifications
   - implementation plan
5. Do not publish unresolved assumptions as if they were approved decisions.