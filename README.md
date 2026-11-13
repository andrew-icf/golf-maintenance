# Golf Maintenance

An internal tool for golf course maintenance crews and management: clock in/out, course and equipment tracking, and staff scheduling.

## Status

Early development, running locally only (not deployed yet). Working end to end, with tests on both sides:

- Authentication, roles, and job titles
- Clock in/out
- Course, holes, and amenities (read-only)
- Equipment tracking with live status updates
- Scheduling: a weekly roster grid with week navigation, one-off and repeating shifts, and click-to-edit shifts for admins

See [Docs](#docs) for what has been decided and what comes next.

## Tech stack

- **Backend:** Go, [chi](https://github.com/go-chi/chi) router, [pgx](https://github.com/jackc/pgx) (PostgreSQL driver)
- **Frontend:** React (Vite), React Router
- **Database:** PostgreSQL in Docker, schema managed with [goose](https://github.com/pressly/goose) migrations
- **Auth:** session-based, HTTP-only cookies, bcrypt password hashing
- **Testing:** Go `testing` + `httptest` against a separate test database; Vitest + React Testing Library
- **Linting:** oxlint (frontend), `gofmt` / `go vet` (backend)

## Getting started

Prerequisites: Docker, Go, Node, and goose (`go install github.com/pressly/goose/v3/cmd/goose@latest`).

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in the values (the dev credentials are in `docker-compose.yaml`). Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8080
```

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Dev database connection |
| `TEST_DATABASE_URL` | backend | Test database connection (database name must end in `_test`) |
| `PORT` | backend | Server port (defaults to 8080) |
| `ALLOWED_ORIGIN` | backend | Frontend origin allowed by CORS |
| `VITE_API_URL` | frontend | Backend base URL |

### 3. Create the test database

```bash
docker exec -it golf-maintenance-db psql -U golfadmin -d golf_maintenance -c "CREATE DATABASE golf_maintenance_test;"
```

### 4. Run migrations

Every migration must be applied to **both** databases:

```bash
cd backend
set -a && source .env && set +a
goose -dir migrations postgres "$DATABASE_URL" up
goose -dir migrations postgres "$TEST_DATABASE_URL" up
```

### 5. Create the first admin

`POST /users` requires an admin, so the first admin is inserted directly. Open a database shell:

```bash
docker exec -it golf-maintenance-db psql -U golfadmin -d golf_maintenance
```

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, password_hash, full_name, role, job_title)
VALUES ('admin@example.com', crypt('change-me', gen_salt('bf', 10)), 'Admin User', 'admin', 'superintendent');
```

Keep the role consistent with the job title's tier (see [Roles and job titles](docs/DECISIONS.md#2-roles-and-job-titles-built)). The API enforces this when creating users, but a direct insert bypasses it.

### 6. Seed sample data (optional, dev only)

```bash
cd backend
docker exec -i golf-maintenance-db psql -U golfadmin -d golf_maintenance -v ON_ERROR_STOP=1 < seed/dev_seed.sql
```

This creates 20 crew members with four weeks of shifts around the current date. It's safe to rerun: users are created once and the crew's shifts are rebuilt each time. Never run it anywhere real.

### 7. Run the backend

```bash
cd backend
go run main.go
```

Runs on `http://localhost:8080`. Restart it after every code change; `go run` does not hot-reload.

### 8. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

## Features

### Schedule

- A weekly grid (Sunday to Saturday): one row per staff member, one column per day, with week navigation and a "This week" shortcut. Today's column and your own row are highlighted.
- Only staff appear as rows, like the paper schedule. Shifts stored for admins stay in the database but don't show in the grid.
- Admins add shifts from the "+ Add shift" dialog, either one-off or repeating weekly for a set number of weeks on chosen days. Repeating skips any date where the person already has a shift, and the dialog confirms how many were added or skipped.
- Admins click any cell to add, edit, or delete that day's shifts. Staff see a read-only grid.
- Times display compactly (`6am – 2:30pm`). Dates travel through the app as `YYYY-MM-DD` strings.

## Testing

```bash
# Backend (integration tests against the _test database)
cd backend
go test -p 1 ./...

# Frontend
cd frontend
npm test
npm run lint
```

`-p 1` is required on the backend: test packages share one database, so they must run one at a time. The test helper refuses to run against any database whose name doesn't end in `_test`, and the test database must be migrated like the dev one.

## Project structure

```
golf-maintenance/
  backend/
    internal/
      auth/        # sessions, RequireAuth, RequireRole
      db/          # connection pool
      handlers/    # HTTP handlers
      middleware/  # CORS
      models/      # data structs, job title mapping
      router/      # route definitions (shared by main.go and tests)
      testutil/    # test database helpers
    migrations/    # goose SQL migrations
    seed/          # dev-only sample data
    main.go
  frontend/
    src/
      constants/   # shared constants (job title labels)
      components/  # shared UI (NavBar, Modal)
      features/
        auth/      # AuthContext, LoginForm, ProtectedRoute
        clock/
        course/
        equipment/
        schedule/  # grid, editor, add-shift dialog, date helpers
      test/        # test setup
      api.js       # centralized API client
      App.jsx
  docker-compose.yaml
```

Each feature folder keeps its components, styles, and tests together.

## Conventions

- Descriptive variable names (`event`, `user`, not `e`, `u`); Go's `w`, `r`, and `t` are the exceptions
- Spaces inside JSX braces: `{ user.name }`
- Tests are written alongside each new feature, with test data and scenario helpers at the top of each suite
- Each new test is proven by breaking the code once and watching it fail
- Rules are enforced on the server; the UI only guides
- Weeks start on Sunday

## Docs

- [docs/DECISIONS.md](docs/DECISIONS.md): every product and engineering decision. It is the source of truth.
- [docs/ROADMAP.md](docs/ROADMAP.md): what is done, the build order, and the backlog.
- [AGENTS.md](AGENTS.md): commands, architecture, conventions, and testing rules for anyone (or any coding agent) working on the code.

## Working with AI agents

This repo is set up for AI coding agents, mainly [Claude Code](https://claude.com/claude-code). The setup has four layers, each stricter than the last:

| Layer | Job | Where |
|---|---|---|
| **Rules** | Guide the agent: architecture, commands, conventions, testing rules | [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md) |
| **Skills** | Make the right workflow repeatable | [`.claude/skills/`](.claude/skills) |
| **Hooks** | Block what must never happen, on every edit | [`.claude/hooks/`](.claude/hooks), [`.claude/settings.json`](.claude/settings.json) |
| **CI** | Gate every pull request | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

Rules are advisory, skills have to be invoked, and hooks only cover Claude Code's edit tools. CI is the backstop that catches what gets past the other three.

### Setup

- **Claude Code** loads [`CLAUDE.md`](CLAUDE.md) automatically. It imports `AGENTS.md` and adds a few Claude-specific notes.
- **Other AI tools** read [`AGENTS.md`](AGENTS.md) directly.

No extra setup is needed. Open the repo in Claude Code, and the rules, skills, and hooks are active.

### Rules

[`AGENTS.md`](AGENTS.md) is the single source of truth for how code is written here. Product decisions live in [`docs/DECISIONS.md`](docs/DECISIONS.md), which wins over everything else, and the build order lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).

When the agent repeats a mistake, don't just correct it in chat. Add the rule to `AGENTS.md`, so every future session, and every tool, picks it up.

### Skills

Run a skill in Claude Code by typing its name:

| Skill | Use it when |
|---|---|
| [`/add-feature`](.claude/skills/add-feature/SKILL.md) | Building a feature or the next ROADMAP step: a fresh branch, a plan checked against `DECISIONS.md`, and checkpoints for the backend, frontend logic, and components |
| [`/review-changes`](.claude/skills/review-changes/SKILL.md) | Before committing: reviews the diff against `AGENTS.md`, `DECISIONS.md`, and the contracts between Go and the frontend. Reports only, never edits |
| [`/fix-flaky-test`](.claude/skills/fix-flaky-test/SKILL.md) | A Vitest or Go test passes or fails intermittently: finds the root cause, and never adds retries, longer timeouts, or skips |

### Hooks

Claude Code runs these automatically ([config](.claude/settings.json)):

- **[protect-files](.claude/hooks/protect-files.js)** (before every edit): blocks edits to `.env` files (except `.env.example`), curl cookie files, and migrations that already exist on `main` or `origin/main`. New migrations on a branch can be edited. Every check ignores capitalization.
- **[lint-edited-file](.claude/hooks/lint-edited-file.js)** (after every edit): runs `gofmt` and `go vet` on edited Go files, and oxlint on edited frontend files. Errors go back to the agent to fix. Warnings don't block.

The settings also deny Claude's Read tool access to `.env` and cookie files. The hooks only cover the edit tools, so the same rules apply to shell commands.

The hooks have their own tests, which also run in CI:

```bash
bash scripts/hooks.test.sh
```

### CI

[`ci.yml`](.github/workflows/ci.yml) runs three jobs on every pull request and every push to `main`:

- **backend:** formatting, `go vet`, and the Go tests against a PostgreSQL service container, with a coverage floor of 70%
- **frontend:** lint, and the Vitest suite with coverage floors of 95% for statements and branches
- **hooks:** the hook tests

**Coverage floors** sit a little below today's numbers, so normal changes don't trip them. Raise a floor when coverage goes up. Never lower one to get a pull request through.

**Branch protection:** a ruleset on `main` requires a pull request and passing `backend`, `frontend`, and `hooks` checks before merging. No approving review is required because this is a solo repo. On a team, we'd also require at least one approval.

### How we work

1. **Plan first.** For anything bigger than a one-line change, the agent proposes a plan in plan mode before touching code.
2. **Review the plan before any code.** Push back on scope, approach, and tests now, while changes are cheap.
3. **Work in checkpoints.** The agent implements in steps, runs the checks, explains what changed, and stops for review.
4. **Review every diff.** Read agent-written code the way you'd read a teammate's PR. `/review-changes` is a second opinion, not a replacement.
5. **A human reviews and merges every PR.** The agent can commit, push, and open PRs when asked.

Commit messages use an area prefix: `(Frontend):`, `(Backend):`, or `(Repo):`.

### Improving the setup

Rules, skills, and hooks are code. Change them through a pull request, like anything else. If a skill or rule keeps producing the wrong result, fix the file instead of working around it in chat.

The latest test audit is in [`docs/test-audit.md`](docs/test-audit.md).