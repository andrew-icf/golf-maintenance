# Roadmap

The build order for Golf Maintenance. Decisions behind each step are in `docs/DECISIONS.md`, which is the source of truth. This file is only about what is done and what comes next.

**How to read it**
- Steps are numbered `N`, and their sub-steps `N-M`. If a step needs more sub-steps, add the next number. Never use letters.
- A step is done only when `npm run lint`, `npm test`, and the backend tests are green and it is committed. Update this file in the same commit that finishes the step, not in each sub-step.
- Every new endpoint gets a gate decision when it is built: open, gated, or admin-only (DECISIONS section 3).
- Work one step at a time.

Last updated: 2026-11-13.

## Current state

- Frontend: **1379 tests in 51 files**. Lint shows one accepted warning (`react(set-state-in-effect)` in `AuthContext.jsx`).
- Backend: **266 router tests and 19 auth tests** (`go test -count=1 -p 1 -coverpkg=./...` is what CI runs, and `go test -count=1 -p 1 ./...` from `backend/` is the quick check).
- Last finished: step 6 (hole features).
- In progress: nothing. Next is step 7, on a new branch.

---

## Done

### Foundations (before numbering)
- Login, sessions, logout, `/me`, job titles with the role derived on the server, and the gardener to greenskeeper rename.
- Clock in and out, the schedule (create, repeat, edit, delete, week views, roster), and the equipment page.
- Course structure: layouts (the nines), holes on layouts, amenities that can sit on a hole, and the Prince Waikiki dev course.
- App shell with a side nav, the Course page, the hole details page, and a non-dismissible modal.
- Backend test helper consolidation into one `helpers_test.go`, with readable one-line scenarios.

### Step 4: The clock-in gate and passwords
| Sub-step | What |
|---|---|
| 4-1 | The server refuses gated routes until staff clock in (admins exempt) |
| 4-2 | `GET /api/my-schedule`, open before clock-in |
| 4-3 | The API client's `getMySchedule` call |
| 4-4 | Building a person's days from their shifts |
| 4-5 | The `useAsyncAction` hook for buttons that call the server |
| 4-6 | The clock-in screen |
| 4-7 | The gate wired into the layout, with pages held back |
| 4-8 | `/me` sends `clocked_in_since` |
| 4-9 | The clock control |
| 4-10 | The control in the top bar, with the Clock page removed |
| 4-11 | The API client reports a status and announces "clock in required" |
| 4-12 | The app reacts to it, and only a real 401 signs someone out |
| 4-13 | The change-password endpoint |
| 4-14 | The password rules in the frontend |
| 4-15 | The change-password form |
| 4-16 | Change password on the clock-in screen and in the top bar |

### Step 5: The checklist preview
| Sub-step | What |
|---|---|
| 5-1 | The rule for who may check a task |
| 5-2 | The sample checklist and the logic for marking tasks |
| 5-3 | Tee box sections (a how-often feature was added here and removed in 5-4) |
| 5-4 | How-often removed, Collect garbage added, tasks renamed |
| 5-5 | Laying the checklist out in role columns |
| 5-6 | The checklist component and its preview wrapper |
| 5-7 | The "Responsible today" list |
| 5-8 | The checklist and who is responsible on the hole page |

### Step 6: Hole features
| Sub-step | What |
|---|---|
| 6-1 | A `hole_features` table. A database trigger gives every hole the standard six features (tee box, par 3 tee box, fairway, approach, rough, green), the migration backfilled the existing holes, and bunkers are numbered from 1. A placeholder seed, `backend/seed/dev_bunkers.sql`, sets each dev hole's bunker count. Database-rule tests, and a test that the Go list of feature types matches the database enum |
| 6-2 | `GET /api/course` sends each hole's features with the hole, in a fixed order and with a stable id for each |
| 6-3 | The checklist is built from the hole's real features: no Bunkers area for a hole without bunkers, and a section for each bunker by its own number. Each task now names the kind of feature it belongs to |

### Small fixes along the way
- Curl cookie files stopped being tracked and are ignored.
- The side nav became a strip across the top on phones and upright tablets.

### Step 20: Tests for the equipment endpoints (done out of order)
Done ahead of steps 7 to 19 as part of batch 1 of `docs/test-audit.md` (the backend gap tests), with the owner's approval. Both equipment endpoints are covered: `GET /api/equipment` (sorted by label, an empty list is `[]`) and `PUT /api/equipment/{id}` (each allowed status, the status allowlist, a bad body, an unknown id). The same batch added tests for creating shifts, logout, login's required fields, and CORS.

---

## Next: Step 7, task templates

Move the task list out of the frontend and into the database, with each task's feature type, who may check it, and its duty. Today the list is written in `frontend/src/features/hole/checklist/checklistTasks.js`. The seeded list is in DECISIONS 7.1, and admin editing of it is step 16. The sub-steps are planned when the step starts.

---

## Upcoming

| Step | What | Notes |
|---|---|---|
| 8 | The daily checklist backend: marks stored per hole per day, the permission rule enforced by job title, "not today," undo, 14-day cleanup, and a full test matrix | Gated for staff. Admins exempt. The server enforces everything the preview only mirrors. Also settles how a page picks up checks made on another tablet (DECISIONS 16) |
| 9 | The real data in the checklist, replacing the preview wrapper | The checklist component stays. Only `ChecklistPreview` is swapped. Checks then survive leaving the page and reach everyone |
| 10 | A "Course tasks" block on the Course page for the landscaper's course-wide tasks | Needs the real task list |
| 11 | Assignments: operator duties for the whole club (a standing person plus a one-day change, may be unassigned, may be several people) and greenskeepers per hole, with Front, Back, and whole-course shortcuts | Feeds "Responsible today" |
| 12 | Hole status: automatic and manual completion, the "Not completed" chip as the control, and progress counts on the hole cards | DECISIONS 7.5 |
| 13 | Pin rotation and the diagram: nine fixed patterns, a club-wide day count, one place to restart it, and the "Pin today" tile | DECISIONS 9 |
| 14 | Green mow direction: the club-wide rotation and the clock-face drawing | Needs the open questions in DECISIONS 16 answered first |
| 15 | The notes block as a placeholder | Real notes are in step 16 |
| 16 | Admin editors: the task list (names, who may check, duty), hole features (including bunker counts and feature on/off), duties, and the **weekly planner** (tick tasks per day, copy to next week). Real notes and photos with file storage. Hole images and tee sets | The biggest step. It will be split into sub-steps when it starts |
| 17 | Remove the old flat `holes` list from the API, the Go models, and the frontend | |
| 18 | Finish the README refresh: the testing commands, an API table (including the `features` list on the `GET /api/course` row), prerequisites, and the project structure | Partly done: the README links to `docs/DECISIONS.md` and `docs/ROADMAP.md`, and the product decisions and feature order were removed from it |
| 19 | Automatic log-out after inactivity, for shared tablets | A PIN or badge login is parked |
| 21 | A hamburger menu in the top bar for the clock status, clock in and out, change password, and log out | The top bar has five things in it and wraps badly on a phone |
| 22 | An admin board: all 27 holes at a glance, who is behind, and which duties are done | The hole cards on the Course page are the first version |
| 23 | Optional cleanup, audit batch 2 of `docs/test-audit.md`: one table-driven test covering all 18 `api.js` wrappers, including the eight that no test calls today | Not pressing. Do when convenient |
| 24 | Optional cleanup, audit batches 3 through 6 of `docs/test-audit.md`: remove the cross-layer duplicate tests that cover the same behavior in more than one layer, for clarity rather than speed | Not pressing. Do when convenient |

---

## Backlog (small items, in no order)

- The sidebar's date goes stale overnight.
- The course is requested twice on first load.
- The schedule grid should fill the screen height.
- An equipment failure shows an `alert()`. It should be an inline message.
- An Equipment nav badge for items that need attention.
- A malformed or impossible date or time returns a 500 where it should be a 400. Creating a shift doesn't check `shift_date` (`banana`, `2026-02-30`), and creating, repeating, and editing don't check `start_time` or `end_time` (`25:00`). Postgres reports these as `22007` and `22008`.
- Share one "clocked in" helper between `/me` and the gate. They each run their own query.
- Use the club's timezone for daily boundaries.
- Scope queries by `course_id`.
- Look at `login_test.go` and `router_test.go` for repeated setup.
- An optional warning for overlapping or very long shifts.
- Decide about the dev seed and the admin. The dev database has an admin, `test@example.com` (a superintendent), but it was made by hand, and `dev_seed.sql` creates no admin, so a fresh setup has none. Either the seed creates an admin, with a known password and a Star Wars name, or `DECISIONS.md` section 14 says a hand-made admin is the way.
- Replace the placeholder bunker counts in `backend/seed/dev_bunkers.sql` with Prince Waikiki's real counts (a list like `A1: 3, A2: 4, ...`).
- Decide what to do about the three `npm audit` findings that already exist on `main`.
- Arrow-key navigation in the schedule grid, instead of one Tab stop per cell.
- Remove the redundant `r.Method` checks in handlers (chi already enforces methods).
- Clean up expired sessions.

## Parked

Decided to do later and not scheduled: forgotten clock-out handling, email and text alerts, language support, user management screens (including password reset), timesheets, time off, deployment, offline mode, backups, a weather and conditions panel, a course map or drawing tool, a people-on-holes view, and a short PIN or badge login. Details are in DECISIONS section 15.
