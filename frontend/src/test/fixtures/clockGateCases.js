import {
  LUKE_WEEK_SHIFTS,
  SPLIT_DAY_DATE,
  SPLIT_DAY_SHIFTS,
  TODAY,
} from './myShiftsCases'

export const GATE_USER = {
  id: 'user-luke',
  full_name: 'Luke Skywalker',
  job_title: 'greenskeeper',
  role: 'staff',
  clocked_in: false,
}
export const GATE_DIALOG_NAME = 'Welcome, Luke Skywalker'
export const GATE_JOB_TITLE_LABEL = 'Greenskeeper'

// People whose gate has no line under the welcome
export const NO_SUBTITLE_USER_CASES = [
  { label: 'no job title', user: { ...GATE_USER, job_title: null } },
  { label: 'a title it does not recognize', user: { ...GATE_USER, job_title: 'smuggler' } },
]

// The week the gate asks the server for, whatever day of it today is
export const WEEK_REQUEST_CASES = [
  { label: 'a Wednesday', today: '2026-10-21', start: '2026-10-18', end: '2026-10-24' },
  { label: 'a Sunday', today: '2026-10-18', start: '2026-10-18', end: '2026-10-24' },
  { label: 'a Saturday', today: '2026-10-24', start: '2026-10-18', end: '2026-10-24' },
  { label: 'a week that crosses the new year', today: '2026-12-31', start: '2026-12-27', end: '2027-01-02' },
]

// The day after the week above ends, so the gate has to ask for the next week
export const NEXT_WEEK_TODAY = '2026-10-25'
export const NEXT_WEEK_START = '2026-10-25'
export const NEXT_WEEK_END = '2026-10-31'

// What the gate says about today for each kind of day
export const TODAY_LINE_CASES = [
  {
    label: 'a day with one shift',
    shifts: LUKE_WEEK_SHIFTS,
    today: TODAY,
    expectedDate: 'Today · Wed, Oct 21',
    expectedLine: '7am – 3:30pm',
  },
  {
    label: 'a day off',
    shifts: LUKE_WEEK_SHIFTS,
    today: '2026-10-22',
    expectedDate: 'Today · Thu, Oct 22',
    expectedLine: 'No shift scheduled today.',
  },
  {
    label: 'a split day',
    shifts: SPLIT_DAY_SHIFTS,
    today: SPLIT_DAY_DATE,
    expectedDate: 'Today · Thu, Oct 22',
    expectedLine: '6am – 10am, 12pm – 4pm',
  },
  {
    label: 'a week with no shifts at all',
    shifts: [],
    today: TODAY,
    expectedDate: 'Today · Wed, Oct 21',
    expectedLine: 'No shift scheduled today.',
  },
]

// The week list for Luke's shifts: each day's label and the shifts on it
export const LUKE_WEEK_ROWS = [
  { label: 'Sun 10/18', shifts: ['Off'] },
  { label: 'Mon 10/19', shifts: ['7am – 3:30pm'] },
  { label: 'Tue 10/20', shifts: ['7am – 3:30pm'] },
  { label: 'Wed 10/21', shifts: ['7am – 3:30pm'] },
  { label: 'Thu 10/22', shifts: ['Off'] },
  { label: 'Fri 10/23', shifts: ['7am – 3:30pm'] },
  { label: 'Sat 10/24', shifts: ['Off'] },
]
export const TODAY_ROW_LABEL = 'Wed 10/21'

// The split day's row lists both shifts, in start-time order
export const SPLIT_ROW = { label: 'Thu 10/22', shifts: ['6am – 10am', '12pm – 4pm'] }

export const SCHEDULE_FAILED_TEXT = 'Your schedule could not be loaded.'
export const SCHEDULE_LOADING_TEXT = 'Loading your schedule...'

export const CLOCKED_IN_USER = { ...GATE_USER, clocked_in: true }

// Who is held at the gate: staff who are not clocked in, and nobody else. The server compares
// the role exactly, so "Admin" is not an admin.
export const GATE_STATUS_CASES = [
  { label: 'an admin who is not clocked in', user: { role: 'admin', clocked_in: false }, expected: false },
  { label: 'an admin who is clocked in', user: { role: 'admin', clocked_in: true }, expected: false },
  { label: 'an admin with no clock status', user: { role: 'admin' }, expected: false },
  { label: 'staff who are clocked in', user: { role: 'staff', clocked_in: true }, expected: false },
  { label: 'staff who are not clocked in', user: { role: 'staff', clocked_in: false }, expected: true },
  { label: 'staff with no clock status', user: { role: 'staff' }, expected: true },
  { label: 'staff with an empty clock status', user: { role: 'staff', clocked_in: null }, expected: true },
  { label: 'staff whose clock status is the text "true"', user: { role: 'staff', clocked_in: 'true' }, expected: true },
  { label: 'a person with no role who is clocked in', user: { clocked_in: true }, expected: false },
  { label: 'a person with no role who is not clocked in', user: { clocked_in: false }, expected: true },
  { label: 'a role spelled "Admin", which the server does not accept', user: { role: 'Admin', clocked_in: false }, expected: true },
  { label: 'no person at all', user: null, expected: true },
  { label: 'an undefined person', user: undefined, expected: true },
]