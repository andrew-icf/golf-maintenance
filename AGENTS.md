# AGENTS.md

Web app for a golf course maintenance crew: schedule, clock in and out, the course and its holes, equipment, and a daily per-hole task checklist. Go + chi + Postgres backend in `backend/`, React + Vite frontend in `frontend/`. The staff device is a cart tablet, and admins use desktop. Runs locally only.

## Source of truth

- **`docs/DECISIONS.md`** holds every product and engineering decision and wins over the README, a chat, or the code. **Read it before designing anything about roles, permissions, the clock gate, or the checklist.** Never build something that contradicts a decision, and never change a decision without asking.
- **`docs/ROADMAP.md`** holds the build order. Work on the current step only, and update the file in the same commit that finishes a step.
- Every new endpoint gets a gate decision when it is built (open, gated, or admin-only; DECISIONS section 3).
- `README.md` covers setup and the API table.

## Working agreement

- Plan before writing code for anything bigger than a one-line change, and wait for approval.
- One step at a time. Finish, test, and commit a step before starting the next. After each step, explain what changed and why, then stop for review.
- Ask before adding a dependency, changing the database schema, or renaming files.
- Run lint and tests on both sides you touched before saying work is done.
- Never commit `.env` files, cookie files, or secrets.

## Commands

```bash
docker compose up -d        # Postgres, container golf-maintenance-db (golf_maintenance and golf_maintenance_test)
```

The database must be running for backend tests and the server.

Backend, from `backend/`:

```bash
go run main.go                                   # :8080, no hot reload; restart after every change
go test -count=1 -p 1 ./...                      # -p 1 is required: all packages share one test database
go test -count=1 -p 1 ./internal/router -run TestName   # single test
gofmt -l . && go vet ./...

# Migrations (goose). Apply every migration to BOTH databases.
set -a && source .env && set +a
goose -dir migrations create <name> sql
goose -dir migrations postgres "$DATABASE_URL" up
goose -dir migrations postgres "$TEST_DATABASE_URL" up

# Dev data (Star Wars crew, password password123). Never anywhere real.
docker exec -i golf-maintenance-db psql -U golfadmin -d golf_maintenance -v ON_ERROR_STOP=1 < seed/dev_seed.sql
docker exec -i golf-maintenance-db psql -U golfadmin -d golf_maintenance -v ON_ERROR_STOP=1 < seed/dev_course.sql
```

Frontend, from `frontend/`:

```bash
npm run dev                                       # :5173
npm test                                          # vitest run
npx vitest run src/features/schedule/WeekGrid.test.jsx -t "test name"   # one file, optionally one test
npm run lint                                      # oxlint
npm run test:coverage                             # vitest with coverage; fails below the floors
```

Agent hooks, from the repo root: `bash scripts/hooks.test.sh`.

### CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`, in three jobs:

- **backend:** Postgres 16 as a service, goose migrations, `gofmt -l`, `go vet`, then `go test -count=1 -p 1 -coverpkg=./...` against a coverage floor.
- **frontend:** `npm ci`, `npm run lint`, `npm run test:coverage`.
- **hooks:** `bash scripts/hooks.test.sh`.

Coverage floors leave room under today's numbers:

| | Floor | Today |
|---|---|---|
| Go statements | 70% (`COVERAGE_FLOOR` in the workflow) | 72.4% locally (CI runs about 0.2 points lower, because `testutil` skips its `.env` loading there) |
| Frontend statements | 95% (`thresholds` in `frontend/vite.config.js`) | 98.7% |
| Frontend branches | 95% | 97.9% |

Never lower a floor to get a change through.

### Environment variables

The Read tool is denied `.env` files (see Agent tooling), and you must not print them from the shell either (`cat`, `grep`, `echo $VAR`, and so on). So these are the names. Ask the user for any value you need.

| Variable | File | Purpose |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | Dev database connection |
| `TEST_DATABASE_URL` | `backend/.env` | Test database connection. The database name must end in `_test` |
| `PORT` | `backend/.env` | Server port (defaults to 8080) |
| `ALLOWED_ORIGIN` | `backend/.env` | Frontend origin allowed by CORS |
| `VITE_API_URL` | `frontend/.env` | Backend base URL |

## Architecture

### Backend (`backend/internal/`)

- `router/router.go` builds the whole chi router and is shared by `main.go` and the tests. Access is layered:
  1. Public: `/health`, `/login`, `/logout`.
  2. `auth.RequireAuth` reads the `session_token` cookie, looks up `sessions`, and puts the user ID in context. Open routes (`/me`, `/api/my-schedule`, clock in/out, change password) sit here.
  3. `auth.RequireRole("admin")` for admin-only routes. Admins are never held at the clock gate.
  4. `auth.RequireClockedIn` for work routes (course, equipment, schedule, roster): staff need an open `clock_entries` row, and admins are exempt. New work endpoints belong in this group.
- `db.Pool` is a package-level `pgxpool`. Handlers write raw SQL against it directly, with no ORM and no repository layer.
- Roles are derived from job titles in `models/job_title.go`, the single source of truth. The frontend labels in `frontend/src/constants/jobTitles.js` must stay in sync.
- Migrations in `backend/migrations/` are never edited once they are on `main`. Add a new one.

### Frontend (`frontend/src/`)

- `api.js` is the only place that calls `fetch` (cookies via `credentials: 'include'`). It throws `ApiError` with the status. A 403 whose body is exactly `clock in required` fires a registered handler that brings up the clock-in gate. `CLOCK_IN_REQUIRED_MESSAGE` there must match `auth.ClockInRequiredMessage` in Go.
- `features/<name>/` keeps a feature's components, CSS, pure logic modules (such as `buildWeekGrid.js` or `checklistLayout.js`), and tests together. Logic is pulled out into plain JS functions and unit-tested separately from components.
- `AuthContext` provides `user` and `loading`. `ProtectedRoute` and `components/layout/AppLayout` (side nav, top bar) wrap every logged-in route in `App.jsx`. `ClockGate` is the non-dismissible clock-in dialog.
- The narrow-layout breakpoint lives in `AppLayout.css`, `SideNav.css`, and `TopBar.css`. Change all three together.

## Code style

- Descriptive names: `event`, `user`, `holeGroup`, never `e`, `u`, or `candidate`. Go's `w`, `r`, and `t` are fine.
- JSX braces get spaces inside: `{ user.name }`.
- Test and dummy data use Star Wars names.
- No Prettier. oxlint only. One accepted warning: `react(set-state-in-effect)` in `AuthContext.jsx`.
- CSS sits next to its component, features live in folders, and non-component JS files are lowercase camelCase.
- Never two files whose names differ only by capitalization. macOS ignores case, and Vite then resolves the wrong file.
- Weeks start on Sunday. Dates travel as `YYYY-MM-DD` strings and are only turned into dates in `features/schedule/scheduleDates.js`, from local calendar fields. Never `new Date('YYYY-MM-DD')`, which parses as UTC.
- The server enforces every rule. The UI only mirrors a rule to decide what to show.

## Testing

Layers:

1. **Backend integration (Go `testing` + `httptest`).** `router/*_test.go` drives `router.New()` against the `_test` database. `testutil.SetupTestDB` refuses any database not ending in `_test` and TRUNCATEs every table.
2. **Frontend unit (Vitest).** Pure logic modules, driven by case tables in `frontend/src/test/fixtures/*Cases.js`.
3. **Frontend component (React Testing Library, jsdom).** Setup is in `src/test/setup.js`, and shared helpers are in `src/test/helpers.js`.

Rules:

- Every change ships with tests. Put test data and scenario helpers at the top of the suite. Shared Go helpers go in `backend/internal/router/helpers_test.go`.
- Prove each new test with a deliberate break check: break the code, watch the test fail, then restore it.
- Test behavior, not implementation. Query by role, label, or visible text, and assert what the user sees, what a function returns, or what the API responds.
- Every test must fail if the code it covers breaks. No tautological assertions, such as asserting a value the test itself set, or that a mock returns what the test told it to.
- No tests that only guard CSS or layout. If a style reflects state (disabled, active, your tasks), test the state.
- Snapshots are never the only assertion.
- Every backend test starts with exactly one of `setUpStaff`, `setUpClockedInStaff`, or `setUpAdmin`, because each wipes the database.
- **A new table must be added to the `TRUNCATE` list in `testutil.SetupTestDB`**, or data leaks between tests.
- `await` every `userEvent` call. Use `findBy*` or `waitFor` for anything that appears after a request.
- A flaky test is a failing test. Never fix it with retries, longer timeouts, or skipping. Find the root cause:
  - Timing: `vi.useFakeTimers()` and `vi.setSystemTime()` instead of real delays or the real clock.
  - Async: await every user event, and use `findBy*` instead of `getBy*` for late content.
  - Shared state: `vi.restoreAllMocks()`, reset module-level state (such as the handler set by `setClockInRequiredHandler` in `api.js`), no `t.Parallel()` in database tests, and always `-p 1`.
  - Dates: week and midnight boundaries, and time zones. Pin the date under test.
- If a flaky test can't be fixed right away, flag it to the user. Don't silently skip or delete it.

## Git

- Small commits at each green checkpoint. Messages are prefixed with the area: `(Frontend): ...`, `(Backend): ...`, or `(Repo): ...`.
- Branch from `main` with a short kebab-case name (for example `hole-features`).
- Never commit `.env` files or cookie files. Curl cookie jars go in `/tmp`.

## Agent tooling

- **Skills** (`.claude/skills/`): `add-feature`, `review-changes`, and `fix-flaky-test`.
- **Hooks** (`.claude/hooks/`, wired in `.claude/settings.json`, tested by `scripts/hooks.test.sh`):
  - `protect-files.js` blocks edits to `.env` files (except `.env.example`), to curl cookie files, and to migrations that already exist on `main` or `origin/main`. Every check ignores capitalization.
  - These hooks only cover the edit tools. The same rules apply to shell commands (`sed -i`, `mv`, `echo >`), so don't use the shell to get around them.
  - `lint-edited-file.js` runs `gofmt` and `go vet` on edited Go files and oxlint on edited frontend files. Errors come back to the agent, and warnings don't block.
- **Permissions:** the Read tool is denied `.env` files and cookie files. That rule doesn't cover the shell, so don't print them from the shell either. Loading `backend/.env` for the goose commands is fine, as long as no value is printed.
