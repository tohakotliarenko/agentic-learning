---
name: investigate-bug
description: Investigate a reported bug, reproduce it, identify the root cause, and propose or implement the smallest safe fix. Use when the user reports incorrect behavior, a regression, a failing scenario, or asks to investigate why something does not work.
---

# Investigate Bug

Investigate the problem before attempting to fix it.

## 1. Understand the report

Identify:

- expected behavior
- actual behavior
- known reproduction steps
- affected component or feature
- relevant constraints

If expected behavior is ambiguous and affects the fix, ask for clarification.

Do not infer product requirements merely from the current implementation.

## 2. Inspect the relevant code

Find the execution path responsible for the reported behavior.

Start with the smallest relevant area of the codebase.

Trace:

1. entry point
2. relevant business logic
3. state or data changes
4. returned or user-visible result

Do not modify code yet.

## 3. Reproduce the bug

When practical, reproduce the reported behavior before fixing it.

Prefer an automated failing test when the bug can be represented clearly as a test.

Confirm that the test:

- fails before the fix
- fails for the expected reason
- represents the reported behavior rather than an implementation detail

If reproduction is not practical, explain why.

## 4. Identify the root cause

Distinguish the root cause from the visible symptom.

Before changing code, determine:

- what condition causes the bug
- why the existing code permits it
- whether related code paths may have the same problem

Do not make speculative changes without evidence.

## 5. Implement the fix

If the user requested a fix:

- make the smallest change that addresses the root cause
- preserve unrelated behavior
- avoid unrelated refactoring
- follow existing project patterns

Do not expand the scope merely because nearby code could be improved.

## 6. Verify

Run the reproduction test first.

Then run the relevant broader verification required by the repository instructions.

Confirm that:

- the original bug is fixed
- the regression test passes
- existing relevant tests still pass
- no unintended behavior changed

## 7. Report

Summarize:

- how the bug was reproduced
- the root cause
- what was changed
- what verification was performed
- any related risks or unresolved issues