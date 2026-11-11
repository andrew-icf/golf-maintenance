---
name: fix-flaky-test
description: Diagnoses and fixes a flaky Vitest or Go test by finding its root cause, per AGENTS.md's testing rules. Never fixes flakiness with retries, longer timeouts, or skipping. Use when a test fails intermittently, is reported as flaky, or passes or fails depending on run order, repetition, isolation, the date, or the time of day.
---

# Fix a flaky test

A flaky test is a failing test. The fix is never retries, longer timeouts, `.skip`, `t.Skip`, or deleting the test. Find and fix the root cause, per the Testing section of `AGENTS.md`. If no root cause can be found, stop and report what you found instead of weakening the test.

## 1. Reproduce

Run the test at least 10 times and count the failures, in each mode below. Record each mode's failure rate (for example 3/10) and the exact error. Flakiness that shows up in only one mode is itself a clue.

**Frontend (Vitest), from `frontend/`:**
- Alone: `fails=0; for i in $(seq 10); do npx vitest run <path> -t "<test name>" || fails=$((fails+1)); done; echo "$fails/10 failed"`
- The whole file: `npx vitest run <path>`
- The full suite: `npm test`
- Shuffled order: `npx vitest run <path> --sequence.shuffle` (repeat it; each run prints `Running tests with seed "<n>"`, so note it for a failing run and replay it with `--sequence.shuffle --sequence.seed=<n>`)

**Backend (Go), from `backend/`** (Postgres must be running):
- Alone, repeated: `go test -count=10 -p 1 -run '^TestName$' ./internal/router`
- The package: `go test -count=1 -p 1 ./internal/router`
- Shuffled order: `go test -count=1 -p 1 -shuffle=on ./internal/router` (note the `-test.shuffle` seed printed for a failing run, and reuse it with `-shuffle=<seed>`)
- The full suite: `go test -count=1 -p 1 ./...`

## 2. Identify the likely cause

Match the error to a category:

- **Shared database state (Go):**
  - The test doesn't start with exactly one `setUpStaff`, `setUpClockedInStaff`, or `setUpAdmin`, or calls a second one mid-test and wipes its own data.
  - It depends on rows from an earlier test.
  - A new table is missing from the `TRUNCATE` list in `testutil.SetupTestDB`.
  - `t.Parallel()` in a database test.
  - Running packages without `-p 1`.
- **Dates and time:**
  - `time.Now()` or `new Date()` near midnight, a Sunday week boundary, or a month end.
  - `new Date('YYYY-MM-DD')`, which parses as UTC and shows the previous day in US time zones.
  - The developer's Mountain time against a UTC assumption.
- **Async (frontend):**
  - An unawaited `userEvent` call.
  - `getBy*` for content that appears after a request, where `findBy*` or `waitFor` is needed.
  - A state update after the test finished.
  - Overlapping `act()` warnings.
- **Leaking mocks or module state:**
  - Mocks not restored (`vi.restoreAllMocks()`).
  - Fake timers left on.
  - Module-level state that outlives a test, such as the handler set by `setClockInRequiredHandler` in `api.js`.
- **Brittle queries:** matching by text that changes, by position, or a query that matches more than one element.
- **A bug in the code itself:** for example async work with no cleanup on unmount, a slower old "who am I" response overwriting a newer one, or a missing `ORDER BY` making row order random.

## 3. Isolate

Narrow to the smallest failing case. Strip the test down to the minimal steps that still reproduce it, and binary-search by removing other tests, mocks, or setup until the cause is unambiguous. Remove any temporary debug logging before moving to the fix.

## 4. Fix the root cause

The fix may belong in the test or in the code:

- **Test-side fixes:**
  - `vi.useFakeTimers()` and `vi.setSystemTime(...)` instead of real delays or the real clock.
  - `findBy*` or `waitFor` instead of fixed waits.
  - `await` every user event.
  - Restore mocks and reset module state between tests.
  - Exactly one `setUp*` per Go test.
  - Pin the date under test.
  - Query by role or label.
- **Code-side fixes:** if the root cause is a real bug (a missing cleanup, a race between requests, an unordered query), fix the code rather than covering it up in the test. Keep or add a test that covers that bug, so a regression would be caught, and break-check it.
- If the failure mode isn't covered by the testing rules in `AGENTS.md`, propose an addition to the user and wait for their approval before editing `AGENTS.md`.

## 5. Prove it

- Re-run the same repetitions from step 1, in the same modes (alone, file or package, shuffled with the failing seed, full suite). Every run must pass.
- Run the full suite on the side you touched (`npm test`, or `go test -count=1 -p 1 ./...`) to confirm nothing else broke.
- Report the failure rate before and after, and the root cause.
- Suggest a commit message with the area prefix, for example `(Frontend): Fixed the week grid test that failed on Sundays`.

## If it can't be fixed

Stop. Report the reproduction steps and failure rate, the errors observed, the causes ruled out, and why a fix isn't in hand. Do not skip, delete, retry-wrap, or lengthen a timeout to make it pass. Flag it for the user instead, per `AGENTS.md`.
