# Golf Maintenance

An internal tool for golf course maintenance staff and management — clock in/out, course and equipment tracking, and staff scheduling.

## Tech Stack

- **Backend:** Go, [chi](https://github.com/go-chi/chi) router, [pgx](https://github.com/jackc/pgx) (PostgreSQL driver)
- **Frontend:** React (Vite), React Router
- **Database:** PostgreSQL (Docker), schema managed with [goose](https://github.com/pressly/goose) migrations
- **Auth:** Session-based, HTTP-only cookies, bcrypt password hashing

## Getting Started

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
go run main.go
```

Runs on `http://localhost:8080`. Requires a `.env` file (see `.env.example` if present, or set `DATABASE_URL` and `PORT`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### 4. Run migrations

```bash
cd backend
goose -dir migrations postgres "postgres://golfadmin:localdevpassword@localhost:5432/golf_maintenance?sslmode=disable" up
```

## Features

- **Auth** — signup (admin-only), login, logout, session persistence
- **Roles** — `admin` (superintendent, assistant superintendent, master mechanic) and `staff` (operator, gardener, landscaper, mechanic, office admin)
- **Clock in/out** — tracks staff shifts with backend-enforced state (can't double clock-in/out)
- **Course** — courses, holes (par/yardage), and amenities (clubhouse, driving range, comfort stations)
- **Equipment** — carts and attached gear (trash cans, tools, etc.) with status tracking (working order / needs repair / in shop)
- **Schedule** — staff shifts by date; viewable by all staff, created by admins only

## Project Structure