# Roadmap

The build order for Golf Maintenance. Decisions behind each step are in `docs/DECISIONS.md`, which is the source of truth. This file is only about what is done and what comes next.

**How to read it**
- Steps are numbered `N`, and their sub-steps `N-M`. If a step needs more sub-steps, add the next number. Never use letters.
- A step is done only when `npm run lint`, `npm test`, and the backend tests are green and it is committed. Update this file in the same commit that finishes the step, not in each sub-step.
- Every new endpoint gets a gate decision when it is built: open, gated, or admin-only (DECISIONS section 3).
- Work one step at a time.

Last updated: 2026-11-18.

## Current state

- Frontend: **1500 tests in 52 files**. Lint shows two accepted warnings, both `react(set-state-in-effect)`: one in `AuthContext.jsx` and one in `useHoleMarks.js`. Each loads data when something opens and sets state after the answer arrives.
- Backend: **613 router tests, 19 auth tests, and 4 jobs tests** (`go test -count=1 -p 1 -coverpkg=./...` is what CI runs, and `go test -count=1 -p 1 ./...` from `backend/` is the quick check).
- Last finished: step 9 (the checklist goes live).
- In progress: nothing. Next is step 10, on a new branch.

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

### Step 7: The task list in the database
| Sub-step | What |
|---|---|
| 7-1 | `duties` and `hole_tasks` tables. The default Prince Waikiki list, 7 duties and 17 tasks, is a seed file, `backend/seed/default_tasks.sql`, safe to rerun. Database-rule tests, and tests that run the seed file for real |
| 7-2 | `GET /api/hole-tasks`, gated like the course (admins exempt), sending the duties and the tasks in order. It is in the clock gate tests |
| 7-3 | The checklist builds from the server's list in place of the one written in the code, working out areas and sections from each task's feature type, and the hole page loads the list alongside the course, with a message where the checklist would be if it cannot load. Collect garbage now sits in the Tee box section, after Cleared |

### Step 8: The daily checklist backend
| Sub-step | What |
|---|---|
| 8-1 | `courses.timezone` (Pacific/Honolulu by default, and the database refuses a name it does not know) and the `task_marks` table: one mark per task, feature, and day, deleted with its hole, feature, or task, and a person who has marked something cannot be deleted |
| 8-2 | `GET /api/holes/{holeId}/marks`, gated like the course: the club's date and today's marks for one hole, each with who made it and when |
| 8-3 | `PUT` and `DELETE /api/marks/{featureId}/{taskId}`, gated: mark a task done or not today, and undo it. The server enforces who may (admins anything, staff only the tasks that name their job title), the first person to mark a task stays on record, and the other status is a 409 until it is undone. Every job title is tested against every task |
| 8-4 | Marks older than 14 days are deleted when the server starts and then once a day (every hour until 9-1), through a small reusable runner, `jobs.RunEvery`, in `backend/internal/jobs` |

### Step 9: The checklist goes live
| Sub-step | What |
|---|---|
| 9-1 | The 14-day mark cleanup runs once a day instead of every hour |
| 9-2 | The API client reads a hole's marks, marks a task, and undoes a mark. It copes with an undo's empty answer, and it encodes the ids so a strange one cannot change the route |
| 9-3 | Each checklist item carries the ids of its task and its feature, and the server's marks turn into what the checklist reads |
| 9-4 | `useHoleMarks`: loads a hole's marks, saves a change, reloads the marks after it, always keeps the newest answer, and works out what to tell the person when something goes wrong |
| 9-5 | Checklist rows can say Saving… and show a short message with a Dismiss button |
| 9-6 | `HoleChecklist`: loads and saves through the hook, holds the checklist back until the marks arrive, says which day the checks are for, and notes that the people under Responsible today are samples |
| 9-7 | The hole page uses it. The preview, its sample marks, the code that worked out marks on the page, and the preview notice are gone |

### Small fixes along the way
- Curl cookie files stopped being tracked and are ignored.
- The side nav became a strip across the top on phones and upright tablets.

### Step 20: Tests for the equipment endpoints (done out of order)
Done ahead of steps 10 to 19 as part of batch 1 of `docs/test-audit.md` (the backend gap tests), with the owner's approval. Both equipment endpoints are covered: `GET /api/equipment` (sorted by label, an empty list is `[]`) and `PUT /api/equipment/{id}` (each allowed status, the status allowlist, a bad body, an unknown id). The same batch added tests for creating shifts, logout, login's required fields, and CORS.

---

## Next: Step 10, course tasks

A "Course tasks" block on the Course page for the landscaper's course-wide tasks (DECISIONS 7.1). It can start with the placeholder tasks, gardening, weed whacking, and clean up, and take the real list when it is ready. The sub-steps are planned when the step starts.

---

## Upcoming

| Step | What | Notes |
|---|---|---|
| 11 | Assignments: operator duties for the whole club (a standing person plus a one-day change, may be unassigned, may be several people) and greenskeepers per hole, with Front, Back, and whole-course shortcuts | Replaces the sample people under Responsible today. The `duties` table already exists |
| 12 | Hole status: automatic and manual completion, the "Not completed" chip as the control, and progress counts on the hole cards | DECISIONS 7.5. Computed from the marks |
| 13 | Pin rotation and the diagram: nine fixed patterns, a club-wide day count, one place to restart it, and the "Pin today" tile | DECISIONS 9 |
| 14 | Green mow direction: the club-wide rotation and the clock-face drawing | Needs the open questions in DECISIONS 16 answered first |
| 15 | The notes block as a placeholder | Real notes are in step 16 |
| 16 | Admin editors: the task list and duties (names, who may check, order), hole features (including bunker counts and feature on/off), the club's timezone, and the **weekly planner** (tick tasks per day, copy to next week). Real notes and photos with file storage. Hole images and tee sets | The biggest step. It will be split into sub-steps when it starts. The tables already exist (step 7). It must also stop `default_tasks.sql` from overwriting the superintendent's edits, so that rerunning it only creates a missing list |
| 17 | Remove the old flat `holes` list from the API, the Go models, and the frontend | |
| 18 | Finish the README refresh: the testing commands, an API table (including the `features` list on the `GET /api/course` row, `GET /api/hole-tasks`, and the three marks routes), prerequisites, and the project structure | Partly done: the README links to `docs/DECISIONS.md` and `docs/ROADMAP.md`, and the product decisions and feature order were removed from it |
| 19 | Automatic log-out after inactivity, for shared tablets | A PIN or badge login is parked |
| 21 | A hamburger menu in the top bar for the clock status, clock in and out, change password, and log out | The top bar has five things in it and wraps badly on a phone |
| 22 | An admin board: all 27 holes at a glance, who is behind, and which duties are done | The hole cards on the Course page are the first version. Looking at past days is not built yet (DECISIONS 15) |
| 23 | Optional cleanup, audit batch 2 of `docs/test-audit.md`: one table-driven test covering all 18 `api.js` wrappers, including the eight that no test calls today | Not pressing. Do when convenient. The three marks calls are already covered in `api.test.js` |
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
- Move the schedule, the clock, and the times shown on checks onto the club's timezone too. Only the checklist's day follows `courses.timezone` today, and the rest use the device's clock.
- After the server refuses a check because the person may not make it, the page could ask who is logged in again. A second login in another window of the same browser replaces the session, and the first window keeps showing the earlier person until it is reloaded. This does not happen with one person to a tablet.
- Scope queries by `course_id`.
- Look at `login_test.go` and `router_test.go` for repeated setup.
- An optional warning for overlapping or very long shifts.
- Decide about the dev seed and the admin. The dev database has an admin, `test@example.com` (a superintendent), but it was made by hand, and `dev_seed.sql` creates no admin, so a fresh setup has none. Either the seed creates an admin, with a known password and a Star Wars name, or `DECISIONS.md` section 14 says a hand-made admin is the way.
- Replace the placeholder bunker counts in `backend/seed/dev_bunkers.sql` with Prince Waikiki's real counts (a list like `A1: 3, A2: 4, ...`).
- Decide what to do about the three `npm audit` findings that already exist on `main`.
- Arrow-key navigation in the schedule grid, instead of one Tab stop per cell.
- Remove the redundant `r.Method` checks in handlers (chi already enforces methods).
- Clean up expired sessions. The runner `jobs.RunEvery` from step 8 is what to use.

## Parked

Decided to do later and not scheduled: forgotten clock-out handling, email and text alerts, language support, user management screens (including password reset), timesheets, time off, deployment, offline mode, backups, a weather and conditions panel, a course map or drawing tool, a people-on-holes view, a short PIN or badge login, a history of who marked and undid what on the checklist, and a page that picks up other tablets' checks by itself, on a timer or when the tab regains focus. Details are in DECISIONS section 15.
