# Decisions

The product and engineering decisions for Golf Maintenance. **This file is the source of truth.** When the README, a chat, or the code disagrees with it, this file wins until someone changes it here on purpose.

- **Status** of each decision: **Built** (in the code and tested), **Decided** (settled, not built yet), or **Open** (needs an answer, collected in section 16).
- **To change a decision:** edit it here, add a line to the change log at the bottom, and update the code and tests in the same commit. Never quietly build something that contradicts a decision. Ask first.
- The build order lives in `docs/ROADMAP.md`. Commands, coding conventions, and testing rules live in `AGENTS.md`.

Last updated: 2026-11-11.

---

## 1. Product

- **What it is.** A web app for a golf course maintenance crew: who is working when (schedule), clocking in and out, the course and its holes, equipment, and a daily per-hole task checklist. First club: Prince Waikiki.
- **Devices.** The cart tablet is the staff device. Admins mostly use a desktop. Phones and tablets held upright get a compact layout (section 13).
- **General, not club-specific.** Nothing about one club is written into code. Club-specific things (the hole layout, the task list, the duties, the pin patterns) are data that an admin can change, so another club can start from the defaults.
- **Time.** The developer works in Mountain time. Dates travel through the app as `YYYY-MM-DD` strings and are only turned into dates in `scheduleDates.js`, from local calendar fields. Using a club timezone for daily boundaries is a backlog item. Until then the device's local date is used.

## 2. Roles and job titles (Built)

| Role | Job titles |
|---|---|
| admin | superintendent, assistant_superintendent, master_mechanic |
| staff | operator, greenskeeper, landscaper, mechanic, office_admin |

- The **server derives the role from the job title** (`backend/internal/models/job_title.go`). A role sent by the client is ignored. The role is compared exactly: `Admin` is not `admin`.
- `gardener` was renamed `greenskeeper` and is no longer a valid title.
- **Admins** edit features, the task list, and the weekly plan (all three admin titles, unless that is narrowed later). **Staff** are read-only except for checking tasks (section 7.3).
- **The server enforces every rule.** The frontend only mirrors a rule to decide what to show.

## 3. Sessions, clocking in, and the clock gate (Built)

### The rule

Information about you and your own time stays open before you clock in. **Work is gated.** Staff must be clocked in to reach anything that is work. Admins are exempt. The server enforces it. Every new endpoint is classified when it is added, and the decision is written down:

| Kind | Endpoints | Rule |
|---|---|---|
| Open (any logged-in person) | `GET /me`, `GET /api/my-schedule`, `POST /clock-in`, `POST /clock-out`, `POST /api/change-password` | On or off the clock |
| Gated (staff must be clocked in) | `GET /api/course`, `GET /api/equipment`, `PUT /api/equipment/{id}`, `GET /api/schedule`, `GET /api/roster` | 403 `clock in required` otherwise |
| Admin-only | creating users, creating, repeating, editing, and deleting shifts | 403 for staff, and admins are never held at the gate |

- "Clocked in" means a `clock_entries` row with `clock_out IS NULL`. A forgotten clock-out still counts as clocked in (the fix is parked, section 15).
- `/me` reports `clocked_in` and `clocked_in_since` (the time of the open entry, or null).
- Sessions are a cookie that expires after 7 days.

### What staff see

- **The clock-in screen.** Staff who are not clocked in see a modal that cannot be dismissed. It shows a welcome, today's shift, their own Sunday-to-Saturday week, Clock in, Change password, and Log out. If their schedule fails to load, they can still clock in.
- **While held**, the pages are not rendered and the sidebar's course request waits, so nothing fires a request that would be refused.
- **After clock-in**, the top bar shows "On the clock · 3h 12m" with Clock out (it asks first). Admins who are not clocked in get a Clock in button there, since they never meet the screen.
- **Clocking out.** Staff are logged out as well as clocked out, so the next person on a shared tablet does not find them signed in or clock in as them. Admins stay logged in, and their control flips to Clock in. If clocking out works but logging out fails, the clock-in screen appears.
- **If the server says `clock in required`** during a session, the app asks who is clocked in again, so the clock-in screen appears on its own.
- **Only a real 401 signs someone out.** A dropped connection or a server error does not. The newest check of "who am I" always wins over a slower older one.

### Changing a password

- Anyone logged in, on or off the clock. It is on the clock-in screen and in the top bar.
- Needs the current password. The new one is at least 8 characters (counted as a person counts, so an emoji is one), at most 72 bytes (bcrypt's limit), not only spaces, and different from the current one. No special-character rules.
- A wrong current password is a **403**, not a 401, because the app reads a 401 as "your session is gone."
- The person's **other sessions end** and this one stays.
- Not built: resetting a forgotten password, and "must change password at first login." Both belong with user management (section 15).

## 4. Schedule (Built)

- Weeks start on Sunday. Range queries take a start and end and are limited to 62 days.
- Admins create, repeat, edit, and delete shifts. A repeat skips dates that already have a shift. A delete takes up to 200 ids.
- **A person can have two shifts in one day** (leaving for an appointment and coming back, or a split day). There is no policing of hours and no overlap check. An optional warning for overlapping or very long days is on the backlog.
- `GET /api/my-schedule` returns only the logged-in person's shifts and is open before clock-in.

## 5. Course structure (Built)

- Our `courses` table is **the club** (Prince Waikiki). Its **`layouts`** are the courses people play: "Course A", "Course B", "Course C", each with a code letter used in hole labels like `C7`.
- A club with one layout shows "Hole 7". The sidebar shows "27 holes · 3 courses" only when there are several layouts.
- Holes belong to a layout, are unique per layout, and have a number of 1 or more. Any club shape works: one to 36 holes, and counts that are not multiples of 9.
- Each layout has a `front_hole_count`, which splits it into Front and Back (for Prince Waikiki, holes 1 to 5 and 6 to 9). The hole page says "Course C · Back C".
- **Amenities belong to the club.** An amenity may point at a hole (the comfort stations sit on A5, B6, and C7), and that link is cleared if the hole goes away.
- Prince Waikiki dev data: three nines of 9 holes, par 36 each, yardages 3,514, 3,600, and 3,649 (10,763 total).
- `GET /api/course` returns `layouts` with their holes, plus an older flat `holes` list that is still sent and is to be removed (roadmap step 17).

## 6. Hole features (Decided, roadmap step 6)

- **Features are the nouns on a hole. Tasks are the verbs.** A hole's checklist for a day is its features combined with the task list.
- **The standard features** are the tee box, the par 3 tee box, the fairway, the approach, the rough, the green, and numbered bunkers.
- **Every hole has exactly one fairway.** The par 3 tee box plays to that same fairway, so there is no separate fairway for it. **Every hole has a par 3 tee box.**
- **Bunkers** are counted per hole and numbered from 1. A hole with none has no Bunkers area.
- **Bunker counts are seeded for now.** Editing them in the app waits for the admin editors (roadmap step 16). Until the real counts are supplied, the seed uses a placeholder pattern of 2 to 5 per hole, clearly marked as placeholder data.
- The approach has no tasks yet.

## 7. The daily hole checklist

### 7.1 The task list (Decided; shown in the preview)

Seeded from Prince Waikiki. G is greenskeeper and O is operator. The duty is who is answerable (section 8).

| Area | Section | Task | May check | Duty |
|---|---|---|---|---|
| Tee box | (none) | Collect garbage | G | Greenskeeper tasks |
| Tee box | Tee box | Cleared | G | Greenskeeper tasks |
| Tee box | Tee box | Mowed | O | Tees and fairways |
| Tee box | Par 3 tee box | Cleared | G | Greenskeeper tasks |
| Tee box | Par 3 tee box | Mowed | O | Tees and fairways |
| Fairway | (none) | Fairway mowed | O | Tees and fairways |
| Fairway | (none) | Cart signs | G | Greenskeeper tasks |
| Fairway | (none) | Fairway sprayed | O | Spraying |
| Rough | (none) | Rough mowed | O | Rough |
| Bunkers | each bunker | Raked by machine | O | Bunkers |
| Bunkers | each bunker | Raked by hand | G | Greenskeeper tasks |
| Green | (none) | Pin placement | G | Greenskeeper tasks |
| Green | (none) | Ball marks | G | Greenskeeper tasks |
| Green | (none) | Top dress | G | Greenskeeper tasks |
| Green | (none) | Mowed | O | Greens |
| Green | (none) | Rolled | O | Rolling |
| Green | (none) | Sprayed | O | Spraying |

- That is 15 tasks on a hole with no bunkers, plus 2 per bunker (21 with three).
- **Collect garbage** is a greenskeeper task on every hole, at the top of the Tee box area.
- **Landscaper tasks are course-wide**, not per hole (placeholders: gardening, weed whacking, clean up; the real list is to come). They belong to the whole course, like flowers and bushes around the clubhouse, and may link to an amenity. They get their own "Course tasks" block on the Course page (roadmap step 10).
- The club keeps **one task list** attached to feature types. Admins edit it and staff cannot. A new club starts from this default list.

### 7.2 Which tasks are on for a day (Decided)

- **Tasks carry no scheduling rules.** There is no "every other day," no "not on weekends," and no per-task frequency. Every task can happen every day. This was tried and deliberately removed, to keep tasks general across clubs.
- **The superintendent plans each week.** For the coming week they tick which tasks are on for each day, in a grid of tasks against days. A "copy to next week" action saves retyping. A task with no plan for a day stays on.
- **Weekends are just a plan.** Example for Prince Waikiki: operators do only the greens mowing and the machine bunker rake, and greenskeepers do the tee box and green tasks, with no hand raking and no par 3 tasks. One greenskeeper covers all nine holes of Course C (an assignment shortcut, section 8).
- Built in roadmap step 16, with the editors.

### 7.3 Who may check, set aside, and undo (Built in the preview; the server enforces in step 8)

- Anyone whose job title is on a task's list may check it **on any hole**. Any greenskeeper may check any greenskeeper task, and any operator any operator task. Admins may check anything.
- **Everyone sees every task.** People who may not check a task see it dimmed in place with a lock that says who it is for. Landscapers, mechanics, and office admins view only.
- **It is an honor system.** Each person checks off only their own work. The people named under "Responsible today" are answerable if something is missed. Permission and responsibility are separate things.
- **Not today** is available on every open task, to anyone who may check it. A task set aside counts as accounted for.
- **Undo** takes back a check or a "not today." Anyone who may check the task may undo it, whoever made the mark.
- The role that a task sits under in the layout is the first job title it names. Who may actually check it is decided by the permission rule, not by the column.

### 7.4 Marks (Built in the preview)

- A mark is `done` or `not_today`, with who made it and when. A task with no mark is open.
- The screen shows the person's **name**. The id is used only to tell "is this me?", so the row says "You · 6:12am" instead of a name. The preview's made-up people have ids that start with `sample-`, so they can never be mistaken for the person looking.
- Marks are never changed in place. Each change returns a new set, or the same one when nothing changed.

### 7.5 A hole is completed (Decided, roadmap step 12)

- **Automatically** when every task on the hole is done or set aside, and there is at least one task.
- **Or by hand** by the people listed under "Responsible today" for that hole, and by admins. It records who did it and how many tasks were skipped.
- Resets daily.
- The "Not completed" chip at the top of the hole page becomes the control: tapping it toggles for people who may, and it is only a status for everyone else. Hole cards on the Course page show progress and a completed mark.

### 7.6 How the checklist is laid out (Built)

- **Role columns.** Greenskeeper tasks on the left, operator tasks on the right. Any other role follows, and tasks that name no role go in an Other column. The viewer's own column carries a "Your tasks" tag, and an admin's columns are all theirs.
- **Area labels run vertically down the left edge** (Tee box, Fairway, Rough, Bunkers, Green). Sections (Tee box, Par 3 tee box, Bunker 1, and so on) are thin sub-headings across both columns, and an area with no tasks is left out.
- **Color.** Greenskeeper boxes are green and operator boxes are amber. A task you may not check keeps its color, paler. A task set aside is gray. Color never carries the meaning alone. Role chips appear only on the "Responsible today" card.
- Real checkboxes, with names like "Bunkers, Bunker 2: Raked by hand." "Not today" and "Undo" buttons are the same width.
- On a narrow screen the columns stack and each stacked group gets a small role label.
- **The hole page** uses the full width. Order: back link, header, par and yardage, "Responsible today," the preview notice, the checklist, then amenities (left) with Notes to come (right). Headings nest: hole title h2, page sections h3, area labels h4, section titles h5.
- The preview (`ChecklistPreview`) shows sample tasks and sample people with the marks kept in memory, labeled "Preview with sample tasks. Checks are not saved." The real checklist replaces only that wrapper in roadmap step 9.

## 8. Duties and who is responsible

- **Duties** group tasks by who is answerable: Greenskeeper tasks, Bunkers, Greens (mowing), Rolling, Spraying (the chemical work), Rough, and Tees and fairways.
- **Operators hold duties across the whole club.** There is one person per duty, usually "their" job, especially senior staff. Others may cover bunkers or greens depending on staffing, so assignment has to be loose:
  - a **standing person** for each duty, set once
  - a **change for a single day** by an admin
  - a duty may be **unassigned** and shows "Not assigned"
  - one person may hold **several duties**, and a duty may list **several people**
- **Greenskeepers are assigned per hole.** One greenskeeper does all the greenskeeper tasks of their assigned hole. Defaults to assign in bulk: Front or Back of a course (for example, Front C is C1 to C5), or the whole course (a weekend greenskeeper covers all of C).
- **The "Responsible today" card** lists each duty with its people and their role chip, with "(you)" beside the viewer, matched by id. It shows nothing when there are no duties.
- Real assignments come in roadmap step 11. The preview uses sample people, and the person looking takes one duty that fits their title.

## 9. Pin position (Decided, roadmap step 13)

- **Diagram.** A circle with one vertical line and two horizontal lines in thirds, back of the green at the top, and today's section shaded. Six sections, numbered 1 to 6 in reading order from the back left.
- **Each hole number from 1 to 9 has its own fixed numbering pattern**, shared across Courses A, B, and C. The patterns are made once at setup, editable by the superintendent, and never reshuffled. Development patterns for holes 1 to 9: 3,2,5,1,4,6 / 1,6,2,5,4,3 / 6,5,1,3,2,4 / 2,4,6,3,1,5 / 5,1,4,6,3,2 / 4,3,1,2,6,5 / 6,2,3,5,1,4 / 1,5,6,4,2,3 / 3,6,4,1,5,2.
- **One club-wide count from 1 to 6 advances every calendar day,** and every hole uses the same number that day. The superintendent sets "day 1" and restarts the count in one place. It overwrites an anchor, with no history.
- Shown as a "Pin today" tile on the hole page, which opens the diagram when tapped.

## 10. Green mow direction (Decided, roadmap step 14)

- One club-wide rotation. Every green is cut in the same direction each day.
- It steps one clock hour a day: 6 to 12, then 7 to 1, and so on.
- Drawn as a small clock face showing only the two numbers with an arrow from the first to the second, so the direction is visual.
- **Open:** whether the cycle is 6 days or 12, and where it sits on the page (section 16). It was left off the hole page for now because the row was getting crowded.

## 11. Notes and photos

- **Now:** a placeholder block only. Categories (damage, items missing, dryness, wetness), a note field, and an Add photo button, all labeled "not saved yet."
- **Later (roadmap step 16):** real notes and photos with file storage.

## 12. Retention

- **14 days** for daily checklists, notes, and photos, then they are deleted automatically.
- Clock and schedule records are separate. They may have legal retention rules, so check with the club and payroll before deleting anything.

## 13. Layout and devices (Built)

- **Desktop and tablets turned sideways:** a sidebar beside the page. The sidebar is sticky.
- **Phones, narrow windows, and tablets held upright:** the sidebar becomes a strip across the top (app and course names on one line, the three links in a row). The condition is a width of 820px or less, or portrait orientation and 1100px or less. It lives in three CSS files (`AppLayout.css`, `SideNav.css`, `TopBar.css`), which must be changed together.
- Touch targets are at least 44px.
- A hamburger menu for the clock status, clock in and out, change password, and log out is planned for the top bar (roadmap step 21).
- Design references are on the canvas at https://claude.ai/artifact/M1oRNKCFQVdXPjozGoUMMr (three versions of the hole page; the third, with area labels down the left, was chosen).

## 14. Engineering decisions

- **Stack.** Go with chi and pgx, goose migrations, and Postgres in Docker. React with Vite, react-router-dom, Vitest, React Testing Library, and oxlint. Details are in `AGENTS.md`.
- **Tests accompany every feature**, and each new test is proven by a deliberate break check. No tests that only guard CSS or layout.
- **Backend tests.** Every test starts with exactly one of `setUpStaff`, `setUpClockedInStaff`, or `setUpAdmin`, because each wipes the database. Suites run with `-p 1` because they share one database.
- **Migrations are applied to both databases** (`golf_maintenance` and `golf_maintenance_test`).
- **Secrets stay out of git.** `.env` files and curl cookie files are ignored. Curl cookie jars go in `/tmp`. The cookie files were once tracked and are not anymore.
- **File names.** Never two files whose names differ only by capitalization. macOS ignores case, and Vite resolves the wrong file.
- **Errors.** A failed API request throws an error that carries its status. One accepted lint warning remains: `react(set-state-in-effect)` in `AuthContext.jsx`.
- **Dev data.** `backend/seed/dev_seed.sql` makes 20 Star Wars crew (password `password123`, an admin `test@example.com`, and a landscaper `newstaffer@example.com`), and `backend/seed/dev_course.sql` makes Prince Waikiki.
- Security headers such as `X-Content-Type-Options: nosniff` on every response are on the deployment list.

## 15. Parked (decided to do later)

- Forgotten clock-out: auto-close or notices (an idea: a 10-hour rule).
- Email and text alerts.
- Language support (last).
- User management screens, including resetting a forgotten password and "must change your password at first login."
- Timesheets and time off.
- Deployment: HTTPS, security headers, backups, and an offline mode.
- A weather and conditions panel (National Weather Service, height of cut, direction).
- A course map or drawing tool, and a people-on-holes view.
- A short PIN or badge login for shared tablets, and an automatic log-out after inactivity (roadmap step 19).
- Hole images: whether on the details page only (recommended, since nine-across cards are too small) or on the cards, and where they come from (club photos, drawn shapes, or none).

## 16. Open questions

- **Weekly plan:** should a week with no plan be all-on, or carry last week's plan forward?
- **Plan edits:** do they take effect from the next day, with an option to apply them to today as well (for a mid-day decision like rain)?
- **Weekend cart signs:** do they stay on? The weekend example does not mention them.
- **Green mow cycle:** after 11 to 5, does it go 12 to 6 (a 12-day cycle) or start over at 6 to 12 (a 6-day cycle)? And where on the hole page does it sit (a tap-to-open tile, a "Today's setup" strip, or a mini clock)?
- **Real bunker counts** for all 27 holes.
- **The real landscaper task list**, and which amenity each one belongs to, if any.
- **Who may edit tasks:** all three admin titles (the current assumption), or only the superintendent.
- **Manual completion:** confirm that "the people listed on a hole's card, plus admins" is the right group.
- **Hole images:** placement and source (section 15).
- **Legal retention** for clock and schedule records.

## 17. Change log

- 2026-11-11: First version, written from the planning conversation.
- 2026-11-11: Conventions and stack details moved from `CLAUDE.md` to `AGENTS.md`. No decision changed.
- Early November 2026: removed per-task scheduling ("every other day," "not on weekends") in favor of a weekly plan the superintendent edits. Tee box tasks became Cleared and Mowed in two sections. The checklist moved to role columns with area labels down the left.
