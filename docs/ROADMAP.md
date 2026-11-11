# Roadmap

The build order for Golf Maintenance. Decisions behind each step are in `docs/DECISIONS.md`, which is the source of truth. This file is only about what is done and what comes next.

**How to read it**
- Steps are numbered `N`, and their sub-steps `N-M`. If a step needs more sub-steps, add the next number. Never use letters.
- A step is done only when `npm run lint`, `npm test`, and the backend tests are green and it is committed. Update this file in the same commit.
- Every new endpoint gets a gate decision when it is built: open, gated, or admin-only (DECISIONS section 3).
- Work one step at a time.

Last updated: 2026-11-11.

## Current state

- Frontend: **1330 tests in 50 files**. Lint shows one accepted warning (`react(set-state-in-effect)` in `AuthContext.jsx`).
- Backend: **200 router tests and 19 auth tests** (`go test -count=1 -p 1 ./...` from `backend/`).
- Last finished: step 5 (the checklist preview), plus the phone and upright-tablet layout and the matching Not today and Undo button widths.
- In progress: nothing. Next is step 6, on a branch called `hole-features`.

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

### Small fixes along the way
- Curl cookie files stopped being tracked and are ignored.
- The side nav became a strip across the top on phones and upright tablets.

---

## Next: Step 6, hole features

Every hole gets real features, and its checklist is built from them. See DECISIONS section 6.

| Sub-step | What | Where |
|---|---|---|
| 6-1 | A table of each hole's features (tee box, par 3 tee box, fairway, approach, rough, green, numbered bunkers). Every existing hole gets the standard six. A separate seed file sets each hole's bunker count (placeholder values until the real ones arrive). Database-rule tests. | Backend |
| 6-2 | `GET /api/course` sends each hole's features with the hole, with tests | Backend |
| 6-3 | The checklist builds from the hole's real features: no Bunkers area without bunkers, and sections that match the count | Frontend |

Gate: the features arrive through `GET /api/course`, which is already gated. No new endpoint.

Needs from you: the real bunker count for each of the 27 holes (a list like "A1: 3, A2: 4, ...").

---

## Upcoming

| Step | What | Notes |
|---|---|---|
| 7 | Task templates seeded with the Prince Waikiki list, stored in the database with each task's feature type, who may check it, and its duty | The seeded list is in DECISIONS 7.1. Admin editing is step 16 |
| 8 | The daily checklist backend: marks stored per hole per day, the permission rule enforced by job title, "not today," undo, 14-day cleanup, and a full test matrix | Gated for staff. Admins exempt. The server enforces everything the preview only mirrors |
| 9 | The real data in the checklist, replacing the preview wrapper | The checklist component stays. Only `ChecklistPreview` is swapped |
| 10 | A "Course tasks" block on the Course page for the landscaper's course-wide tasks | Needs the real task list |
| 11 | Assignments: operator duties for the whole club (a standing person plus a one-day change, may be unassigned, may be several people) and greenskeepers per hole, with Front, Back, and whole-course shortcuts | Feeds "Responsible today" |
| 12 | Hole status: automatic and manual completion, the "Not completed" chip as the control, and progress counts on the hole cards | DECISIONS 7.5 |
| 13 | Pin rotation and the diagram: nine fixed patterns, a club-wide day count, one place to restart it, and the "Pin today" tile | DECISIONS 9 |
| 14 | Green mow direction: the club-wide rotation and the clock-face drawing | Needs the open questions in DECISIONS 16 answered first |
| 15 | The notes block as a placeholder | Real notes are in step 16 |
| 16 | Admin editors: the task list (names, who may check, duty), hole features (including bunker counts and feature on/off), duties, and the **weekly planner** (tick tasks per day, copy to next week). Real notes and photos with file storage. Hole images and tee sets | The biggest step. It will be split into sub-steps when it starts |
| 17 | Remove the old flat `holes` list from the API, the Go models, and the frontend | |
| 18 | Refresh the README: the project structure, the fixtures and commit conventions, and the greenskeeper rename | Partly done: the README now links to `docs/DECISIONS.md` and `docs/ROADMAP.md`, and the product decisions and feature order were removed from it |
| 19 | Automatic log-out after inactivity, for shared tablets | A PIN or badge login is parked |
| 20 | Tests for the equipment endpoints, which have none | |
| 21 | A hamburger menu in the top bar for the clock status, clock in and out, change password, and log out | The top bar has five things in it and wraps badly on a phone |
| 22 | An admin board: all 27 holes at a glance, who is behind, and which duties are done | The hole cards on the Course page are the first version |

---

## Backlog (small items, in no order)

- The sidebar's date goes stale overnight.
- The course is requested twice on first load.
- The schedule grid should fill the screen height.
- An equipment failure shows an `alert()`. It should be an inline message.
- An Equipment nav badge for items that need attention.
- Creating or repeating a shift for a user that doesn't exist returns a 500. It should be a 400.
- Share one "clocked in" helper between `/me` and the gate. They each run their own query.
- Use the club's timezone for daily boundaries.
- Scope queries by `course_id`.
- Look at `login_test.go` and `router_test.go` for repeated setup.
- An optional warning for overlapping or very long shifts.
- Add an admin to the dev seed. `dev_seed.sql` has none today, though DECISIONS section 14 says it has `test@example.com`.
- Arrow-key navigation in the schedule grid, instead of one Tab stop per cell.
- Remove the redundant `r.Method` checks in handlers (chi already enforces methods).
- Clean up expired sessions.

## Parked

Decided to do later and not scheduled: forgotten clock-out handling, email and text alerts, language support, user management screens (including password reset), timesheets, time off, deployment, offline mode, backups, a weather and conditions panel, a course map or drawing tool, a people-on-holes view, and a short PIN or badge login. Details are in DECISIONS section 15.
