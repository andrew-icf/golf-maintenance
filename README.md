# Golf Maintenance

An internal tool for golf course maintenance crews and management: clock in/out, course and equipment tracking, and staff scheduling.

## Status

Early development, running locally only (not deployed yet). Working end to end, with tests on both sides:

- Authentication, roles, and job titles
- Clock in/out
- Course, holes, and amenities (read-only)
- Equipment tracking with live status updates
- Scheduling, including one-off and repeating weekly shifts

See [Upcoming features](#upcoming-features) for what's next.

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

### 5. Run the backend

```bash
cd backend
go run main.go
```

Runs on `http://localhost:8080`. Restart it after every code change; `go run` does not hot-reload.

### 6. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### First admin

`POST /users` requires an admin, so the first admin has to be inserted directly into the database. A seed script is planned.

## Features

### Roles and job titles

Each user has a job title, and the title determines the role. The client never chooses a role.

| Role | Job titles |
|---|---|
| `admin` | superintendent, assistant superintendent, master mechanic |
| `staff` | operator, gardener, landscaper, mechanic, office admin |

### What each role can do

- **Everyone logged in:** clock in/out, view the course, equipment, and schedule, and update equipment status
- **Admins only:** create users, create shifts (one-off or repeating weekly)

### API

| Method | Path | Access |
|---|---|---|
| GET | `/health` | public |
| POST | `/login` | public |
| POST | `/logout` | public |
| POST | `/users` | admin |
| GET | `/me` | logged in |
| POST | `/clock-in`, `/clock-out` | logged in |
| GET | `/api/course` | logged in |
| GET | `/api/equipment` | logged in |
| PUT | `/api/equipment/{id}` | logged in |
| GET | `/api/schedule` | logged in |
| POST | `/api/schedule` | admin |
| POST | `/api/schedule/repeat` | admin |
| GET | `/api/users` | admin |

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

`-p 1` is required on the backend: test packages share one database, so they must run one at a time. The test helper refuses to run against any database whose name doesn't end in `_test`.

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
    main.go
  frontend/
    src/
      constants/   # shared constants (job title labels)
      components/  # shared UI (NavBar)
      features/
        auth/      # AuthContext, LoginForm, ProtectedRoute
        clock/
        course/
        equipment/
        schedule/
      test/        # test setup
      api.js       # centralized API client
      App.jsx
  docker-compose.yaml
```

Each feature folder keeps its components, styles, and tests together.

## Conventions

- Descriptive variable names (`event`, `user`, not `e`, `u`); Go's `w`, `r`, and `t` are the exceptions
- Spaces inside JSX braces: `{ user.name }`
- Tests are written alongside each new feature
- Frontend and backend rules are both enforced server-side; the UI only guides

## Upcoming features

In planned order:

1. **Edit and delete shifts**, for PTO, days off, and one-off changes
2. **Admin user management UI**, including the job title dropdown
3. **Timesheets**, an admin view of hours worked from clock entries
4. **Equipment assignment**, assigning a cart and its attached gear to a staff member (the `assigned_user_id` column is already in place)
5. **Hole progress tracker**, task completion per hole with notes and photo upload (introduces file storage)
6. **Housekeeping**, see below
7. **Deployment**, hosting, HTTPS, and the `Secure` cookie flag

Later ideas: more amenity types (pools, tennis courts), multi-course support, and a cart-tablet login flow.
