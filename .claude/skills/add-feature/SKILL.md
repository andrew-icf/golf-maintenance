---
name: add-feature
description: Workflow for building a feature or ROADMAP step in this app, from a fresh branch through scoped planning against docs/DECISIONS.md, checkpointed backend and frontend implementation with tests, and manual verification. Use when the user asks to add or build a feature, or to start the next roadmap step.
---

# Add a feature

Follow these steps in order. Work on your own between checkpoints, but always stop at each checkpoint and whenever a "Stop early" condition applies.

## 1. Start a branch

- Run `git status` to confirm the working tree is clean. If it isn't, stop and ask how to handle the changes in progress.
- Branch from an up-to-date `main` with a short kebab-case name, as the repo already does (for example `hole-features`, `change-password`), with no `feature/` prefix:
  `git checkout main && git pull && git checkout -b <short-kebab-name>`.
- If `docs/ROADMAP.md` names a branch for the step, use that name.

## 2. Restate the feature and settle scope

- Restate the feature in 1–3 sentences. If it is a ROADMAP step, name the step and its sub-steps.
- **Read `docs/DECISIONS.md`.** You must read it before designing anything about roles, permissions, the clock gate, or the checklist. Quote the sections that apply. If the feature would contradict a decision, stop and ask. Never quietly build around a decision.
- Ask about scope: what's in, what's explicitly out, edge cases, which roles and job titles see or do what, and UI expectations on the cart tablet and on desktop. Use `AskUserQuestion` for concrete choices.
- **Classify every new endpoint** as open, gated (staff must be clocked in), or admin-only, per DECISIONS section 3. If that isn't settled, ask.
- Don't explore until scope is reasonably clear.

## 3. Explore the codebase

- Follow `AGENTS.md` for architecture, conventions, and testing rules.
- Backend:
  - routes in `backend/internal/router/router.go` (which group?)
  - handlers in `internal/handlers/`
  - models and the job-title map in `internal/models/`
  - existing migrations
  - `router/helpers_test.go`
- Frontend:
  - the feature folder in `frontend/src/features/<name>/`
  - `api.js`
  - shared components in `components/`
  - case tables in `src/test/fixtures/*Cases.js`
  - `src/test/helpers.js`
- Prefer reusing existing helpers (the `setUp*` scenarios, `src/hooks/useAsyncAction.js`, `features/schedule/scheduleDates.js`, `components/Modal.jsx`) over writing new ones.

## 4. Propose a plan (Checkpoint 0)

- Group the plan by the checkpoints below, listing the files and tests for each, and the gate decision for each endpoint.
- Call out any schema change, new dependency, or file rename. Each needs explicit approval.
- Wait for explicit approval before writing any code.

## 5. Implement by checkpoint

Write code and tests together within each checkpoint. Never defer tests to the end. Skip any checkpoint the feature doesn't touch.

1. **Backend.**
   - A **new** migration (`goose -dir migrations create <name> sql`), applied to **both** databases. Never edit a migration that is already on `main`.
   - Every new table added to the `TRUNCATE` list in `testutil.SetupTestDB`.
   - Handlers with raw SQL on `db.Pool`, and the route in the right router group.
   - Integration tests in `router/*_test.go`, each starting with exactly one `setUpStaff`, `setUpClockedInStaff`, or `setUpAdmin`. Cover the gate: staff off the clock, staff on the clock, and an admin.
   - Record the gate decision in DECISIONS section 3, and ask first if it is a new decision.
2. **Frontend logic.** The `api.js` call, and pure modules in the feature folder, unit-tested with Vitest from a `*Cases.js` table.
3. **Components and wiring.** Components with React Testing Library tests (query by role, label, or text; `await` user events), wired into routes or pages. Mirror the server's rule to decide what to show. The server enforces it.

At each checkpoint:

- Run the checks for the sides you touched, and make sure they pass. Never stop at a checkpoint with failing checks.
  - Backend, from `backend/`: `gofmt -l .`, `go vet ./...`, and `go test -count=1 -p 1 ./...`
  - Frontend, from `frontend/`: `npm run lint` (one accepted warning) and `npm test`
- **Break-check every new test.** Break the code it covers, watch it fail, then restore. Say which break you used.
- If the checkpoint finishes a ROADMAP sub-step, update `docs/ROADMAP.md` (and the test counts in "Current state") in the same commit.
- Summarize what changed and why.
- **Suggest a commit message** prefixed with the area: `(Backend): ...`, `(Frontend): ...`, or `(Repo): ...` for docs and tooling. Use one commit per area when a checkpoint spans more than one. Wait for approval before continuing.

## Stop early if

- The work needs to deviate from the approved plan
- A new dependency is needed
- The schema changes beyond what was approved, or a file would be renamed
- The work would contradict `docs/DECISIONS.md`, or a decision turns out to be missing or open
- An existing API response shape, route, or the clock-in message would change
- A test is flaky (use the `fix-flaky-test` skill), or requirements are ambiguous

## 6. Wrap up: manual verification

List anything the automated tests don't cover, for the user to check by hand:

- Restart the backend (`go run main.go` doesn't hot-reload), and confirm both databases are migrated.
- In the browser at `http://localhost:5173` (seed users, password `password123`):
  - as staff before clocking in (the clock-in screen should hold them)
  - as staff after clocking in
  - as an admin
- Layout on a wide desktop window, and the narrow layout (820px or less, or an upright tablet). Touch targets are at least 44px.

Don't claim the feature is done. Report that implementation and automated checks are complete, and list what's left to confirm by hand.
