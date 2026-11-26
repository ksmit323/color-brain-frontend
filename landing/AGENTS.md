## Code style

- Functions: should be under 20 lines.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`. Prefer names that return <5 grep hits in the codebase.
- Types: explicit. No `any`, no untyped functions.
- No code duplication. Extract shared logic into a function/module.
- Early returns over nested if's. Max 2 levels of indentation.
- Exception messages must include the offending value and expected shape.

## Comments

- Preserve existing comments. Don't strip them on refactor — they carry intent and provenance.
- Write WHY, not WHAT. Skip `// increment counter` above `i++`.
- Docstrings on public functions: intent + one usage example.
- Reference issue numbers / commit SHAs when a line exists because of a specific bug or upstream constraint.

## Tests and verification

- Done means two things: the checks pass, and you ran the change and saw it work.
- Checks: `npx tsc --noEmit`. Run them before you commit. They catch regressions; they don't prove the change works. No test command detected. Ask before adding a test framework.
- Before you call a nontrivial change to product code done, or commit it, run the `verify` skill. If it fails, fix and verify again.
- New tests, in this order of preference:
  1. End-to-end: one test per user flow, through the real interface (Playwright, driving the UI in a real browser). Name the steps so a failure says which step broke.
  2. Property: for logic with rules that always hold (round-trips, invariants, idempotency, fast path equals slow path). Use fast-check.
  3. Differential: when rewriting or migrating, run old and new on the same inputs and compare.
- Don't write a unit test per function, and don't write tests first by default. Add an example-based unit test only for a tricky pure function that no end-to-end or property test reaches.
- Bug fix: reproduce the bug through the real interface first, then add a regression test at the highest level that would have caught it.
- Use real local dependencies (database, local server). Fake only third-party services you can't run locally.
- Never weaken, skip, or rewrite a test to make your change pass. If the test is wrong, stop and explain why.
- Flaky test: no retries, no sleeps. Find the cause. If you can't, delete it and say why in the commit message.
- If a check or verification still fails after 3 fix attempts, stop and show me the failure.

## Structure

- Follow Astro conventions.
- Prefer small focused modules over god files.
- Predictable paths: src/pages/, src/components/

## Formatting

- Use the project's existing formatter. Don't discuss style beyond that.

## Logging

- Structured JSON when logging for debugging / observability.
- Plain text only for user-facing CLI output.

## Anti-Complexity Constraints

Before adding abstraction, first look for the simplest implementation
that satisfies the requirement.

Do not introduce:
- new layers
- interfaces
- services
- factories
- event systems
- caching
- dependencies
- generalized frameworks

unless there is a demonstrated need.

Prefer deleting code over adding abstraction.

After implementation, inspect the diff specifically for:
- unnecessary abstractions
- speculative generalization
- duplicated logic
- excessive indirection
- code that could be simpler
