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

This creates 20 Star Wars crew members (for example `luke.skywalker@example.com`, password `password123`) with four weeks of shifts around the current date. It's safe to rerun: users are created once and the crew's shifts are rebuilt each time. Never run it anywhere real.

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

### API

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/health` | public | |
| POST | `/login`, `/logout` | public | |
| POST | `/users` | admin | Needs email, password, full name, and job title; the role is derived from the title |
| GET | `/api/users` | admin | Id, name, role, and job title only |
| GET | `/me` | logged in | Includes job title and whether the user is clocked in |
| POST | `/clock-in`, `/clock-out` | logged in | |
| GET | `/api/course` | logged in | |
| GET | `/api/equipment` | logged in | |
| PUT | `/api/equipment/{id}` | logged in | Updates status |
| GET | `/api/roster` | logged in | Staff only: id, name, job title |
| GET | `/api/schedule` | logged in | Optional `?start=YYYY-MM-DD&end=YYYY-MM-DD` (both or neither, up to 62 days) |
| POST | `/api/schedule` | admin | One shift |
| PUT | `/api/schedule/{id}` | admin | Changes a shift's date and times |
| DELETE | `/api/schedule` | admin | Body `{"ids": [...]}`, up to 200, all or nothing |
| POST | `/api/schedule/repeat` | admin | Start date, weeks, days, and times; skips existing dates |

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
- Test and dummy data uses Star Wars character names
- Tests are written alongside each new feature, with test data and scenario helpers at the top of each suite
- Each new test is proven by breaking the code once and watching it fail
- Rules are enforced on the server; the UI only guides
- Weeks start on Sunday

## Docs

- [docs/DECISIONS.md](docs/DECISIONS.md): every product and engineering decision. It is the source of truth.
- [docs/ROADMAP.md](docs/ROADMAP.md): what is done, the build order, and the backlog.
- [AGENTS.md](AGENTS.md): commands, architecture, conventions, and testing rules for anyone (or any coding agent) working on the code.
