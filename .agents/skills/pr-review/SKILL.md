---
name: review-pr
description: Review a pull request or proposed code change for correctness, regressions, requirement compliance, test coverage, and meaningful engineering risks. Use when the user asks to review a PR, branch, diff, or proposed implementation.
---

# Review PR

This skill is read-only by default.

Do not modify files, fix findings, post comments, approve, merge, or otherwise change external systems unless the user explicitly requests a separate write action.

## 1. Establish the review target

Identify what is being reviewed:

- GitHub pull request
- current branch against its base
- provided diff
- specific commits

When reviewing an external PR, retrieve its description, changed files, diff, and relevant metadata using available tools.

Determine the intended base and head revisions before reviewing the change.

## 2. Establish the review baseline

Identify the sources that define expected behavior:

- active task or ticket
- acceptance criteria
- approved clarifications
- approved requirement changes
- approved implementation plan, when available
- relevant repository instructions

If the PR references a task or ticket, read it before judging requirement compliance.

Treat requirements as authoritative over the implementation plan.

Do not infer intended product behavior solely from the implementation.

If important requirement context is unavailable, state that limitation rather than inventing it.

## 3. Understand the change

Before looking for defects, understand:

- what behavior the PR intends to change
- which execution paths are affected
- which files are merely supporting changes
- what existing behavior must remain unchanged

Inspect relevant surrounding code when the diff alone is insufficient.

## 4. Review the implementation

Look for concrete issues involving:

- incorrect behavior
- missed requirements
- regressions
- edge cases
- error handling
- state consistency
- API or data compatibility
- security and permissions
- concurrency or ordering issues when relevant
- unintended scope changes

Do not report speculative issues without a plausible failure scenario.

Do not report formatting or stylistic preferences unless they materially affect correctness, maintainability, or established repository conventions.

## 5. Review tests

Determine whether tests:

- cover the requested behavior
- cover important edge cases
- protect existing behavior from regression
- would fail if the implementation were broken
- test behavior rather than unnecessary implementation details

Missing tests should be reported when they create meaningful regression risk.

## 6. Verify when practical

Run relevant read-only verification commands when useful and permitted.

Examples include:

- targeted tests
- relevant broader tests
- typecheck
- lint

Do not modify the repository in order to make verification pass.

Distinguish failures caused by the PR from pre-existing failures when possible.

## 7. Compare against requirements

Before completing the review, explicitly verify the implementation against the current requirement set.

Check for:

- requirements not implemented
- behavior contradicting requirements
- unapproved requirement changes
- material deviations from the approved plan

A deviation from the plan is not a finding by itself if the requirements are still correctly satisfied.

## 8. Report findings

Report actionable findings first.

For each finding include:

- severity
- file and relevant location
- the concrete problem
- why it matters
- the scenario in which it fails

Prefer a small number of high-confidence findings over a large number of speculative observations.

If there are no meaningful findings, say so explicitly and mention any remaining review limitations or unverified risks.