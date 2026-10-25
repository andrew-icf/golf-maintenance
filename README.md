# Golf Maintenance

An internal tool for golf course maintenance crews and management: clock in/out, course and equipment tracking, and staff scheduling.

## Status

Early development, running locally only (not deployed yet). Working end to end, with tests on both sides:

- Authentication, roles, and job titles
- Clock in/out
- Course, holes, and amenities (read-only)
- Equipment tracking with live status updates
- Scheduling: a weekly roster grid with week navigation, one-off and repeating shifts, and click-to-edit shifts for admins

See [Upcoming features](#upcoming-features) for what's next, and [Product decisions](#product-decisions) for what has already been settled.

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

Keep the role consistent with the job title's tier (see [Roles and job titles](#roles-and-job-titles)). The API enforces this when creating users, but a direct insert bypasses it.

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

## Product decisions

Settled during planning; the details may still change when each piece is built.

- **Layout:** a hybrid. Admins get a side-nav shell with wide content, staff get a "My day" screen built for the cart tablet, and everyone gets the course map as a page. Desktop web first, but the cart tablet is the main staff device, so buttons stay touch-friendly and readable in sunlight.
- **Clock-in gate:** before clocking in, nothing but clock-in is reachable, and the dialog can't be dismissed. Log out stays available inside it. It shows today's shift and a small week view of the person's own shifts. The server enforces the gate too. Still to settle: whether anyone can view the schedule page before clocking in, and whether admins are exempt.
- **Shifts and time:** a straight 9-hour shift, with no break or lunch punches for now. A clock entry still open after 10 hours is closed automatically and flagged for admin review.
- **People on holes (v1):** planned positions come from task assignments, and any clocked-in staff member can check in manually to any hole, assigned or not. A manual check-in expires on clock-out, on checking into another hole, or after a timeout (length to be decided). GPS from the cart tablets is a possible later source.
- **Course map:** v1 is a stylized 2D map drawn from our own hole shapes. Aerial and 3D views come later.
- **Conditions panel:** weather for today and tomorrow only, height of cut per area (greens, tees, fairways, approaches, rough), and direction of cut. Direction is a line through a clock face that rotates one hour each day (6–12 becomes 7–1, then 8–2).
- **Equipment:** current status only, with no history.

## Upcoming features

In planned order:

1. **Checkbox multi-select on the schedule grid,** with a delete bar for removing several shifts at once (the backend endpoint is ready)
2. **App shell and hard clock-in gate:** side nav, top bar, wide layout, non-dismissible clock-in dialog with focus containment, and the server-side check
3. **Role-based homes:** an admin landing page and the staff "My day" screen
4. **Tasks:** a task library, a workboard (assign by person, date, and hole), and completion with notes and photos (the first need for file storage)
5. **Course map:** a drawing tool for hole shapes, the 2D map page, and people on holes
6. **Conditions panel:** weather, height of cut, and direction of cut
7. **Everything else:** admin user management UI, cart assignment, timesheets and labor reports, time-off requests, safety and training records, translation, and notes and alerts
8. **Hardening:** deployment with HTTPS and the `Secure` cookie flag, offline tolerance, backups, and GPS tracking as an add-on

### Housekeeping backlog

- Return `400` instead of `500` when a shift is created for a nonexistent user
- Add an admin to the dev seed
- Guard the clock button against double clicks
- Make `Modal` contain keyboard focus (needed before the clock-in gate)
- Arrow-key navigation in the schedule grid, instead of one Tab stop per cell
- Remove the redundant `r.Method` checks in handlers (chi already enforces methods)
- Scope course and equipment queries by `course_id`
- Clean up expired session