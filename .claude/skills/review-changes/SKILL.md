---
name: review-changes
description: Reviews uncommitted changes or a branch's changes against this project's AGENTS.md rules, docs/DECISIONS.md, and the Go/frontend contracts before committing, and suggests prefixed commit messages. Review only. It never edits files unless the user separately asks. Use when the user wants a pre-commit review, a second look at a diff, or to check a branch is ready to commit or merge.
---

# Review changes

This is a review, not an implementation task. Do not edit, fix, or stage any files during this skill. Only report findings. If the user wants fixes applied, that's a separate, explicit follow-up request.

## 1. Gather the changes

- Run `git status` to see tracked and untracked changes.
- Run `git diff` for unstaged changes and `git diff --staged` for staged ones. Read untracked files directly.
- For a whole branch, use `git diff main...HEAD` (the merge-base diff, not `main..HEAD`) to see only what the branch adds.
- Read every changed file in full, not just the diff hunks. A line can look fine alone and still be wrong in its function.

## 2. Run the checks

Run each check for the sides the diff touches, and report the results:

- Backend, from `backend/`:
  - `gofmt -l .` (any output is a failure)
  - `go vet ./...`
  - `go test -count=1 -p 1 ./...` (needs Postgres: `docker compose up -d`)
- Frontend, from `frontend/`:
  - `npm run lint`. The only accepted warning is `react(set-state-in-effect)` in `AuthContext.jsx`. Any other warning is a finding.
  - `npm test`. You may narrow it to affected files with `npx vitest run <path>` if the full suite is slow, but say that you narrowed it.

Report pass or fail and paste the relevant failure output. Don't fix failures yourself. A failure is a finding, not a task.

## 3. Review against the checklist

Group findings under these categories, checking only what's relevant to the diff.

**Tests**
- Every behavioral change ships with a test. Ask whether each new test was break-checked (broken once and seen to fail).
- Assertions are meaningful. No tautologies, such as asserting a value the test set, or that a mock returns what it was told to.
- No test exists only to guard CSS or layout. Snapshots are never the only assertion.
- Components are queried by role, label, or visible text. `userEvent` calls are awaited, and late content uses `findBy*` or `waitFor`, not fixed delays.
- Frontend case data lives in `src/test/fixtures/*Cases.js`, and shared helpers in `src/test/helpers.js`.
- Every backend test starts with exactly one `setUpStaff`, `setUpClockedInStaff`, or `setUpAdmin`. Shared Go helpers go in `router/helpers_test.go`.
- New endpoints have tests for each side of their gate: staff off the clock, staff on the clock, and an admin.

**Conventions**
- Descriptive names (no `e`, `u`, or `candidate`). Go's `w`, `r`, and `t` are fine. Spaces inside JSX braces: `{ user.name }`.
- Test and dummy data use Star Wars names.
- Dates travel as `YYYY-MM-DD` strings and are turned into dates only in `scheduleDates.js`. Never `new Date('YYYY-MM-DD')`. Weeks start on Sunday.
- Feature folders, with logic in pure modules rather than components. CSS sits next to its component. Non-component JS files are lowercase camelCase.
- No two files whose names differ only by capitalization.
- A change to the narrow-layout breakpoint touches all three of `AppLayout.css`, `SideNav.css`, and `TopBar.css`.
- Rules are enforced on the server. A rule that exists only in the UI is a finding.

**Contracts**
- **The clock-in message matches.** `ClockInRequiredMessage` in `backend/internal/auth/clocked_in.go` and `CLOCK_IN_REQUIRED_MESSAGE` in `frontend/src/api.js` must be the identical string. Check it on every review, even when the diff touches only one side:
  `grep -n 'ClockInRequiredMessage =' backend/internal/auth/clocked_in.go; grep -n 'CLOCK_IN_REQUIRED_MESSAGE =' frontend/src/api.js`
- **New tables are truncated.** For every `CREATE TABLE` in a new migration, the table must appear in the `TRUNCATE TABLE ...` statement in `testutil.SetupTestDB` (`backend/internal/testutil/testutil.go`). A missing table leaks rows between tests, so it is a must-fix.
- **Job titles stay in sync.** A change to `backend/internal/models/job_title.go` is matched in `frontend/src/constants/jobTitles.js`, and the reverse.
- **Endpoints are gated.** Every new route sits in the right group in `router/router.go` (open, admin-only, or the `RequireClockedIn` work group), and its gate is recorded in DECISIONS section 3.
- **Migrations are new.** No migration that is already on `main` was edited (`git diff main...HEAD -- backend/migrations` shows only added files). New migrations were applied to both databases.

**Decisions and roadmap**
- Nothing in the diff contradicts `docs/DECISIONS.md`. A changed decision must be edited there, with a change-log line, in the same commit.
- If the diff finishes a ROADMAP sub-step, `docs/ROADMAP.md` is updated in the same commit.

**Safety and scope**
- No secrets, `.env` contents, or cookie files committed.
- No leftover debugging code (`console.log`, `fmt.Println`, commented-out blocks, `.only` or `.skip` in tests).
- No new dependency without the user's approval.
- No unrelated changes mixed in, such as formatting churn on untouched lines or edits to unrelated files.

## 4. Report findings

Group findings by severity:

- **Must fix:** breaks a hard rule or contract above, a check fails, or there's a real bug.
- **Should fix:** a real gap, such as a missing test or a convention violation, that doesn't block the commit.
- **Consider:** a suggestion or judgment call, not a rule violation.

For each finding, give the file, the line or line range, and a suggested fix (described, not applied).

End with:

1. A verdict, **ready to commit** or **not ready**, with a one- or two-sentence reason tied to the findings. For example: "Not ready. One must-fix: the new `hole_features` table isn't in the TRUNCATE list in `testutil.SetupTestDB`, so feature rows from one test will leak into the next."
2. **Suggested commit message(s)**, prefixed with the area. Split by area when the diff spans more than one:
   - `(Backend): ...` for `backend/`
   - `(Frontend): ...` for `frontend/`
   - `(Repo): ...` for docs, tooling, and repo settings

   Write them in the repo's style: past tense, plain words, describing what the app now does (for example `(Backend): Added the change-password endpoint, open to anyone logged in`).
