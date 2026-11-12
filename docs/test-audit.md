# Test audit

Audit of the Go and frontend test suites against the Testing rules in `AGENTS.md`, on branch `test-audit` (on top of `4929a3a`), 2026-11-11. This audit only reports: no test was edited or deleted.

## Summary

**Verdict: a sound suite.** It has no tautological assertions, no snapshot tests, no `.skip` or `.only`, and no unrestored fake timers or mocks. Tests query by role, label and text, pin their dates, and use deferred promises to cover races. The real issues are:

1. **The backend has gaps.** Most of the 67% figure is untestable error branches, but some server rules have no test at all: creating a shift, equipment status validation, and logout.
2. **Many rules are re-tested through components.** Rules are tested in a pure module, then the same case table is run again through a component, sometimes through a page as well.
3. **Smaller issues:** a few layout-only tests, one weak assertion, and text read through CSS-class selectors.

| Recommendation | Findings | Test cases removed |
|---|---|---|
| Remove | 5 | 10 (4 Go, 6 frontend) |
| Merge | 15 | 103 (13 Go, 90 frontend) |
| Rewrite | 6 | none, plus new tests for the gaps below |
| Keep (looked suspect, justified) | 6 | — |

That is 113 of 1549 runs: 17 of 219 in Go, and 96 of 1330 on the frontend.

**Measured coverage impact of all removals and merges together: none.**
- **Backend:** 469 of 697 statements before and after, with no block lost or gained.
- **Frontend:** 1002 of 1015 statements and 707 of 722 branches before and after.
- **One recommendation was changed to keep coverage.** F4 first proposed removing all four page-width tests. Measuring showed that loses the two branches of the `reading` fallback in `AppLayout.jsx`, so F4 now keeps that one test.

**Measured run-time saving:**
- **Backend:** 0.71 s of the 7.2 s run. Mostly bcrypt (B2) and building clubs (B3).
- **Frontend:** about 0.1 s of 9.5 s, which is within run-to-run noise, because jsdom setup per file dominates.

So the frontend merges are about clarity and maintenance, not speed. Rewriting F21 is the only frontend change likely to save measurable time.

**Flakiness check:** nothing reproduced.
- **Frontend:** the full suite passed in UTC, Los Angeles and UTC+14, and with three shuffled orders.
- **Go:** it passed three times with `-shuffle=on`, with `-count=3`, and with `TZ=Pacific/Kiritimati`.

## Baseline

| | Backend (Go) | Frontend (Vitest) |
|---|---|---|
| Test files | 17 (1 helpers only) | 50 |
| Definitions | 99 `func Test` | 662 (511 single tests, 151 table sites) |
| Table-driven cases | 120 subtests | 819 |
| Total runs | 219 | 1330 |
| Run time | ≈ 7.2 s (`-p 1`) | ≈ 9.5 s (half is jsdom setup) |
| Statement coverage | 67.3% (`-coverpkg=./...`) | 98.7% statements, 97.9% branches |

**Slowest backend files:**
- `change_password_test.go`: 1.67 s, from bcrypt
- `course_rules_test.go`: 0.65 s
- `users_test.go`: 0.64 s
- `course_test.go`: 0.46 s
- `my_schedule_test.go`: 0.35 s

**Slowest frontend files:**
- `ScheduleView.test.jsx`: 1.57 s
- `AddShiftModal.test.jsx`: 1.55 s
- `Checklist.test.jsx`: 1.50 s
- `AppLayout.test.jsx`: 1.50 s
- `ChecklistPreview.test.jsx`: 1.45 s

**Backend coverage by package:**

| Package | Coverage |
|---|---|
| `models`, `router` | 100% |
| `auth` | 81.5% |
| `middleware` | 75% |
| `handlers` | 64.8% |
| `testutil` | 75.9% |
| `db`, `main` | 0% |

**Frontend coverage gaps:**
- **`api.js` (80%):** eight wrappers are never called in a test (`login`, `logout`, `clockOut`, `getUsers`, `getRoster`, `createSchedule`, `repeatSchedule`, `updateSchedule`).
- **`main.jsx` (0%):** the entry point.
- **Everything else** is at or near 100%.

To reproduce:

```bash
cd backend && go test -count=1 -p 1 -json ./...
cd backend && go test -count=1 -p 1 -coverpkg=./... -coverprofile=/tmp/go.cover ./...
cd frontend && npx vitest run --includeTaskLocation --reporter=json --outputFile=/tmp/vitest.json
cd frontend && npx vitest run --coverage --coverage.reportsDirectory=/tmp/cov \
  --coverage.include='src/**/*.{js,jsx}' --coverage.exclude='src/**/*.test.{js,jsx}' --coverage.exclude='src/test/**'
```

## Frontend and backend balance

`AGENTS.md` says the server enforces every rule, so the backend's 67% against the frontend's 99% deserves a look. **It is partly a real gap, but much smaller than the numbers suggest.** Of the 228 uncovered backend statements:

| Kind | Statements |
|---|---|
| `if err != nil { log; 500 }` branches for database or system failures | 124 |
| Unreachable: `r.Method` checks that chi already enforces (backlog), and "no user in context" behind `RequireAuth` | 28 |
| Wiring and test helpers (`main.go`, `db.go`, `testutil`) | 35 |
| **Untested behavior** | **≈ 37** |

Under normal database conditions, the reachable request paths are about **92% covered**. The untested behavior is concentrated in a few places, in priority order:

1. **`handlers/schedule.go` `CreateSchedule` (POST `/api/schedule`).**
   - **What's missing:** the whole create path is untested: the bad body, the "end after start" check (lines 60–63), the insert, and the 201 response. It is only reached by the clock-gate test with `{}`.
   - **Why it matters:** the frontend tests this same rule in two components (`ShiftEditor`, `CreateShiftForm`), so the rule is tested only on the side that doesn't enforce it.
   - **Smaller gaps:** `RepeatSchedule`'s bad-body branch and its `weeks < 1` default.
2. **`handlers/equipment.go` (53%).**
   - **What's missing:** the status allowlist (`!validStatuses[req.Status]`, line 34), the bad body, a successful update, and a list with any equipment in it. Its only coverage comes from the clock-gate tests reaching the routes.
   - **Why it matters:** this is the only server-side check on equipment status, and ROADMAP step 20 already plans these tests.
3. **`handlers/users.go`.**
   - **What's missing:** `Logout` is entirely untested: deleting the session row and clearing the cookie. So are login's 400 for a missing email or password, and its bad-body branch.
   - **Why it matters:** "logout ends the session on the server" is a security-relevant rule with no test.
4. **`middleware/cors.go`:** the OPTIONS preflight and the default origin.
5. **The API client contract.** The eight untested `api.js` wrappers above decide the path, method and body that the Go handlers parse. A table-driven test in `api.test.js` (path, method, body keys) would close the frontend side for little cost.

**Not worth chasing:** the database-failure branches. Integration tests can't reach them without fault injection, and a single shared helper for the `log; 500` pattern would cut them down more cheaply.

## Findings: backend (`backend/internal/router`, grouped by feature)

**B1. Duplicate 401 checks. Remove.**
- **Session (`/me`):** `me_clock_test.go` `TestMe_RequiresASession` (`recorder := sendRequest(staff.handler, http.MethodGet, "/me", "", nil)`) repeats the first half of `router_test.go` `TestRequiresSession`.
- **Schedule:** `schedule_range_test.go` `TestGetSchedules_RequiresASession` repeats the "view the schedule" row of `clock_gate_test.go` `TestClockGate_RequiresASessionFirst`. The middleware refuses before the range is parsed.
- **Roster and course:** the `{"no session", nil, http.StatusUnauthorized}` rows in `TestRoster_AvailableToAnyUserOnTheClock` and `TestGetCourse_Access` repeat the same clock-gate rows.
- **Why it matters:** the same middleware path is asserted twice. The other rows of those two tests are kept, since they assert an exact 200, which the gate tests don't.
- **Change:** −2 tests, −2 subtests.

**B2. Change password: accepted rows re-test the unit rules. Merge.**
- **Where:** `change_password_test.go` `TestChangePassword_AcceptsPasswordsAtTheLimits`. Each of its 4 rows runs `setUpStaff` and bcrypt, while the file itself says the rules "are tested one by one in the auth package, so this proves they are wired in".
- **Recommendation:** keep `"exactly 72 bytes"`, a real bcrypt boundary, and drop the other three.
- **Change:** −3 subtests, about 0.2 s.

**B3. Course: redundant rows. Merge.**
- **Club shapes:** `TestGetCourse_ClubShapes` (`clubShapes`, 10 rows) runs the same code path for every size. Keep a single hole, twelve holes, `[9, 6]`, `[9, 9, 9]` and `[9, 9, 9, 9]`. Change: −5.
- **Course rules:** in `course_rules_test.go`, the negative-value rows ("a negative play position", "a negative front hole count", "a negative hole number") hit the same `> 0` CHECK as the zero rows. In `TestCourseRules_HoleNumbersHaveNoUpperLimit`, rows 18 and 36 add nothing that 100 doesn't. Change: −5.

**B4. Weak assertion. Rewrite.**
- **Where:** `schedule_test.go` `TestRepeatSchedule_UnknownUserCreatesNothing` asserts `if recorder.Code == http.StatusOK`, so it passes on the known 500.
- **Recommendation:** assert 400 when the backlog item "Creating or repeating a shift for a user that doesn't exist returns a 500" is fixed.

**B5. Tests start with `SetupTestDB`, not a `setUp*` helper. Keep, and adjust the rule.**
- **Where:** for example `clock_test.go` (`testutil.SetupTestDB(t)` in `TestClock_RequiresSession`), `login_test.go`, `router_test.go`, `course_test.go`, `course_rules_test.go`, and `users_test.go` `TestJobTitles_GoMapMatchesDatabaseEnum`.
- **Why they're fine:** they wipe the database exactly once, which is the rule's purpose, and most need no signed-in person.
- **Recommendation:** reword AGENTS.md to "exactly one database wipe: a `setUp*` helper, or `testutil.SetupTestDB` when no signed-in person is needed". `TestCreateUserPermissions` and `TestRequiresSession` could use `setUpAdmin` or `setUpStaff` plus `newPerson`, which is low priority.

**B6. Keep.** `invalidRangeQueries` runs against both `/api/schedule` and `/api/my-schedule`. Both share `scheduleRangeFromQuery`, but each endpoint's wiring needs its own check, and the 14 rows take about 0.01 s.

**B7. Keep.** The rows in `TestCreateUser_RejectsMissingOrInvalidJobTitle` take the same path, but each one records a decision in DECISIONS 2: `"Superintendent"` (exact comparison) and `"gardener"` (retired).

## Findings: frontend

### `src` root (`api`, `App`)

**F1. `api.test.js` `FAILED_STATUS_CASES`. Merge.** All 6 rows (`{ status: 400 }` … `{ status: 500 }`) pass the status through unchanged. Keep one 4xx row and one 5xx row. Change: −4.

**F2. "Course requested once" tested twice. Remove one.** `App.test.jsx` "keeps one layout while moving between pages, asking for the course only once" (`expect(apiMock.getCourse).toHaveBeenCalledTimes(1)`) repeats `AppLayout.test.jsx` "asks for the course once, even when moving between pages". The fetch belongs to `AppLayout`, so keep that one. Change: −1.

### `components/layout`

**F3. Per-page heading rows. Remove.** `AppLayout.test.jsx` `it.each(NAV_ITEMS)('shows $title as the heading at $path')` repeats `App.test.jsx` `it.each(NAV_ITEMS)('shows $label inside the layout at $path')`. The `App` version already renders the real layout and asserts `heading, { level: 1, name: item.title }`. Change: −3.

**F4. Page width tests are layout-only. Merge.**
- **Where:** `AppLayout.test.jsx` "page width": `expect(container.querySelector('.app-layout-page')).toHaveClass(\`app-layout-page-${item.width}\`)`, 3 rows, plus "gives a page that is not in the nav the reading width".
- **Why it matters:** the rule (AGENTS.md, DECISIONS 14) is "no tests that only guard CSS or layout", and `navItems.test.js` already checks each width is allowed.
- **Recommendation:** remove the 3 per-page rows. Keep the "not in the nav" test.
- **Why keep that one:** removing it loses 2 of the 18 branches in `AppLayout.jsx`, the `navItem?.width ?? 'reading'` fallback (measured). Nothing else reaches that fallback, and it decides how an unknown page is laid out.
- **Change:** −3.

**F5. Gate rows per page. Merge.** `AppLayout.test.jsx` `it.each(NAV_ITEMS)('holds back the $label page behind the gate')` takes the same path as "shows the gate, with no page and no course request". The gate wraps the outlet whatever the route. Change: −3.

**F6. TopBar re-tests the label formatter. Merge.**
- **Job titles:** `TopBar.test.jsx` `it.each(JOB_TITLE_CASES)` renders all 8 titles, which repeats `formatJobTitle`'s own "has a label for every title the backend can send". Keep 1 row. Change: −7.
- **Page titles:** `PAGE_TITLES` has 4 rows, one of them the retired `'Clock'`, all passing a prop through. Keep 1 row. Change: −3.

**F7. SideNav re-tests the summary formatters. Merge.**
- **Course size and yardage:** `COURSE_DISPLAY_CASES` (8 rows) repeats `formatCourseSize` and `formatYardage`, which `SideNav.jsx` imports and `courseSummary.test.js` covers with 10 and 6 rows. Keep "three nines" and "a course with no yardage entered". Change: −6.
- **Dates:** the 3 `DATE_CASES` (2026-10-21, 2027-01-01, 2028-02-29) are the same dates as rows in `SHORT_DATE_CASES` in `scheduleDates.test.js`. Keep 1. Change: −2.

### `constants`

**F8. Unknown-value rows repeat `lookupLabel`. Merge.**
- **Where:** `amenities.test.js` and `equipment.test.js` run `UNKNOWN_VALUE_CASES` through each formatter, 5 + 6 × 2 rows.
- **Why it matters:** each formatter is one line, `return lookupLabel(…)`, and `lookupLabel.test.js` already covers the same unknown, inherited-name, `__proto__`, empty, null and undefined cases.
- **Recommendation:** keep one wiring row per formatter.
- **Change:** −14.

**F9. Keep.**
- **Equipment and amenity type labels:** the per-type label rows and "covers exactly the types in the test list" restate the source, since no database enum backs them. They are cheap and document the text people see.
- **Status and job title labels:** these mirror real database enums, so they're a real contract.

### `features/auth`

**F10. Password form rules run twice. Merge.**
- **Where:** `ChangePasswordForm.test.jsx` `it.each(FORM_CASES)('reports $label')` re-runs all 13 rows of `passwordRules.test.js` `validatePasswordForm`, rendering and submitting the form each time.
- **Recommendation:** keep "everything right", one single-error row, and "a new password and a confirmation that are both wrong".
- **Change:** −10.

**F11. Listener registration is an implementation detail. Remove.**
- **Where:** `AuthContext.test.jsx` "registers a listener for it" (`expect(typeof newestListener()).toBe('function')`).
- **Why it matters:** "asks who is logged in again…" calls the same listener and checks the behavior. The cleanup test that expects `null` is kept, since it's the only way to see that contract.
- **Change:** −1.

**F12. Keep.** `passwordRules` mirrors the server's rules case for case, which DECISIONS 2 intends: the server enforces, and the frontend mirrors.

### `features/clock`

**F13. Week-request rows repeat date math. Merge.**
- **Where:** `ClockGate.test.jsx` `it.each(WEEK_REQUEST_CASES)`, 4 rows (Wednesday, Sunday, Saturday, new year).
- **Why it matters:** `ClockGate` calls `getWeekStart` and `getWeekDates`, and `scheduleDates.test.js` covers those with `WEEK_START_CASES` and a loop over every day of 2026 and 2027.
- **Recommendation:** keep 1 row, plus "asks for the new week when the date moves into the next one".
- **Change:** −3.

### `features/course` and `features/hole`

**F15. Club shapes rendered at two component layers. Merge.**
- **Where:** `CourseView.test.jsx` `it.each(CLUB_SHAPES)` renders 10 shapes, each with a full page load. `CourseView` renders `LayoutSection` for each layout, and `LayoutSection.test.jsx` runs the same 10 shapes.
- **Recommendation:** remove the `CourseView` rows, and trim `LayoutSection`'s to the 5 representative shapes from B3. `courseSummary` (pure) keeps all 10.
- **Change:** −15.

**F16. Amenity link rows repeat `AmenityList`. Merge.** `CourseView.test.jsx` `it.each(AMENITY_LINK_CASES)` repeats `AmenityList.test.jsx`. Keep one row: it proves the card and the amenity link agree, which is integration-only. Change: −2.

**F17. Pure cases re-run through `HoleDetailsView`. Merge.**
- **Not found:** `NOT_FOUND_CASES` (5 rows) is fully covered by `holeDetails.test.js`. Keep 1. Change: −4.
- **Yardage:** `YARDAGE_CASES` (4 rows) — keep null → `—` and zero → `0 yds`. The test also re-implements the formatting (`expected === null ? '—' : \`${expected} yds\``). Change: −2.
- **Viewer tags:** `VIEWER_PAGE_CASES` (3 rows) repeats F18. Keep 1. Change: −2.

**F18. "Your tasks" tagging in three layers. Merge.** `Checklist.test.jsx` `it.each(VIEWER_CASES)` re-runs `checklistLayout.test.js`'s `VIEWER_CASES` table (8 rows) unchanged. Keep 1 component row. Change: −7.

### `features/equipment`

**F19. EquipmentView: style next to state, and repeated renders.**
- **Style assertions. Rewrite.** `EquipmentView.test.jsx` asserts the row tint class right beside the select value, for example `expect(rowOf(selectNamed(select))).toHaveClass(tint)` next to `toHaveValue(status)`, and again at lines 254–255, 306 and 325. The rule says to test the state, not the style, and the value already proves the state. Drop the class lines.
- **Untouched rows. Merge.** `UNTOUCHED_BY_WEED_EATER_CHANGE` repeats a full render and change for each of its 4 rows. One test checking all 4 dropdowns is just as strong. Change: −3.

### `features/schedule`

**F20. Highlights.**
- **Remove.** `WeekGrid.test.jsx` "marks no row when the current user is not on the roster" repeats `buildWeekGrid`'s `NO_CURRENT_USER_CASES` row "is not on the roster". `ScheduleView`'s admin version is kept as the wiring check. Change: −1.
- **Rewrite.** The today column is asserted only through `toHaveClass('today')`. Expose it as `aria-current="date"`, as `ClockGate` already does, and assert that instead. This needs a small component change. The `current-user` row class has no ARIA equivalent, so keep it.

**F21. Confirmation wording tested through full form fills. Rewrite.**
- **Where:** `AddShiftModal.test.jsx` `it.each(CONFIRMATION_CASES)`, 5 rows, each filling the whole form to test headline wording.
- **Recommendation:** pull the wording into a pure helper with a table test, and keep one component row, as AGENTS.md already advises for logic.
- **Change:** about −0.5 s.

**F22. Duplicated helper. Rewrite.** `createDeferred` is redefined locally in `ScheduleView.test.jsx`, `ShiftEditor.test.jsx` and `EquipmentView.test.jsx`, although `src/test/helpers.js` exports it.

### Across folders

**F23. Text read through CSS-class selectors. Rewrite opportunistically.**
- **Where:** 85 uses in 17 files, for example:
  - `ClockGate` `row.querySelector('.clock-gate-day-label')` and `document.querySelector('.clock-gate-today-line')`;
  - `HoleCard` `textsIn(container, '.hole-number, .hole-detail')`;
  - `Checklist` `.checklist-head` and `.checklist-meta`;
  - "no line" checks such as `document.querySelector('.modal-subtitle')` and `.top-bar-user-title`.
- **Why it's low priority:** these tests aren't wrong, but they're tied to markup.
- **Recommendation:** where a role, label or `within(...).getByText` query exists, prefer it.

**F24. Keep.** Some rows in pure tables take the same branch: the non-`ApiError` rows in `CLOCK_IN_REQUIRED_CASES` and `UNAUTHORIZED_CASES`, the admin rows in `GATE_STATUS_CASES`, and parts of `COURSE_SIZE_CASES` and `HOLE_COUNT_TEXT_CASES`. They cost almost nothing and document security and gating decisions (DECISIONS 3). The same goes for `checklistMarks` `checkItem` re-running the whole `canCheckTask` matrix.

## Sound areas

These folders were checked against every rule and had nothing beyond the items above:
- `hooks/`
- `features/clock` logic (`clockStatus`, `clockElapsed`, `myShifts`)
- `features/schedule` `scheduleDates`, `buildWeekGrid`, `ShiftEditor`, `ScheduleView`
- `features/hole/checklist` logic (`taskPermissions`, `checklistTasks`, `checklistMarks`, `responsibleList`) and `ChecklistPreview`
- `components/Modal`
- backend auth, clock, clock-gate, my-schedule, roster and schedule edit and delete tests

They share these habits:
- dates are pinned (`vi.setSystemTime`, or fixed RFC 3339 times in Go), and fake timers are always restored;
- deferred promises cover in-flight and race states;
- every mock is reset in `beforeEach`;
- frozen inputs prove pure functions don't mutate what they're given;
- every Go test wipes the database exactly once.

## Recommended resolutions

These are batches in priority order, each sized for one PR.

1. **Backend gap tests (`(Backend):`).** Not a cleanup, but the highest value.
   - **Tests to add:**
     - `CreateSchedule`: 201, end before or equal to start, bad body, staff 403;
     - equipment status update: valid, invalid status 400, bad body, unknown id 404, list with items;
     - `Logout`: session row deleted and cookie cleared;
     - login 400 for a missing field;
     - CORS preflight.
   - **Also:** B4.
   - **Effect:** about +15 Go tests and +0.3 s. `handlers` goes from 64.8% to about 72%, and reachable behavior to about 98%.
2. **API contract table (`(Frontend):`).** One table-driven test of the path, method and body keys for all 18 `api.js` wrappers. **Effect:** `api.js` 80% → 100%, +18 cases, about 0 s.
3. **Cross-layer duplicates on the frontend (`(Frontend):`).** F2, F3, F5, F6, F7, F8, F10, F13, F15, F16, F17, F18. **Effect:** −84 cases. Run time unchanged within noise. Coverage unchanged (measured).
4. **Rule fixes on the frontend (`(Frontend):`).** F4, F11, F19, F20, F22. **Effect:** −8 cases. Coverage unchanged (measured, with F4 keeping its "not in the nav" test). F20's today column needs a small component change.
5. **Backend trims and rule wording (`(Backend):` + `(Repo):`).** B1, B2, B3, plus the AGENTS.md wording from B5. **Effect:** −17 runs (2 tests, 15 subtests) and −0.71 s. Coverage unchanged (measured).
6. **Optional (`(Frontend):`).** F1, F21 and F23.
   - **F1:** −4 cases.
   - **F21:** −4 component cases and +5 pure ones, and likely about −0.5 s. It needs new code, so it isn't measured.
   - **F23:** no change in count.

## Method and limits

- **Measured:**
  - all counts, from `go test -json`, and from Vitest's JSON reporter with `--includeTaskLocation` (tests sharing a definition site count as table cases);
  - run times;
  - coverage, from `-coverpkg=./...` and `@vitest/coverage-v8` with every source file included;
  - the classification of uncovered Go statements, by reading each uncovered block;
  - the flakiness runs listed in the summary.
- **Read:** every test file and the fixtures it uses. Each finding quotes the line it rests on.
- **Coverage impact, measured by running the suites without the recommended removals:**
  - **Frontend:** one coverage run with `-t` set to a negative-lookahead pattern over the exact names of the 96 removed cases. Vitest joins describe names with ` > `.
  - **Go:** one run with `-skip` for the 9 affected tests, plus one run for each affected test with only its surviving rows (`-run '^TestX$/^(rows)$'`). The coverage profiles were then merged and compared block by block with the baseline.
- **Time saved:**
  - **Go:** the baseline elapsed times of the 17 removed runs, added up.
  - **Frontend:** two timed full runs with and without the removals.
- **Still estimates:** the effects of new tests (resolution batches 1 and 2) and of F21, since they need new code.
