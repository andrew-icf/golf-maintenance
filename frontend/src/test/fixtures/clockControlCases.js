const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

// When Luke clocked in, written the way the server writes it (Go sends microseconds)
export const SINCE_TEXT = '2026-10-31T16:37:23.388402-06:00'
export const SINCE_MS = Date.parse('2026-10-31T16:37:23.388-06:00')
export const SEVEN_MINUTES_LATER_MS = SINCE_MS + 7 * MINUTE_MS

// Three hours and twelve minutes after he clocked in, so the chip says "3h 12m"
export const CHIP_NOW = new Date(SINCE_MS + 3 * HOUR_MS + 12 * MINUTE_MS)

// How long someone has been on the clock, at different moments after SINCE_TEXT
export const ELAPSED_CASES = [
  { label: 'the moment they clocked in', nowMs: SINCE_MS, expected: '0m' },
  { label: 'under a minute later', nowMs: SINCE_MS + 59 * 1000, expected: '0m' },
  { label: 'exactly a minute later', nowMs: SINCE_MS + MINUTE_MS, expected: '1m' },
  { label: 'a minute and a half later', nowMs: SINCE_MS + 90 * 1000, expected: '1m' },
  { label: 'fifty-nine minutes later', nowMs: SINCE_MS + 59 * MINUTE_MS, expected: '59m' },
  { label: 'exactly an hour later', nowMs: SINCE_MS + HOUR_MS, expected: '1h 0m' },
  {
    label: 'three hours and twelve minutes later',
    nowMs: SINCE_MS + 3 * HOUR_MS + 12 * MINUTE_MS,
    expected: '3h 12m',
  },
  {
    label: 'over a day later, as after a forgotten clock-out',
    nowMs: SINCE_MS + 26 * HOUR_MS + 5 * MINUTE_MS,
    expected: '26h 5m',
  },
  { label: 'a start time ahead of the device clock', nowMs: SINCE_MS - 5 * MINUTE_MS, expected: '0m' },
]

// The same moment written several ways. Seven minutes later, every one reads 7m.
export const TIMESTAMP_SPELLING_CASES = [
  { label: 'microseconds, as the server sends it', since: SINCE_TEXT },
  { label: 'milliseconds', since: '2026-10-31T16:37:23.388-06:00' },
  { label: 'whole seconds', since: '2026-10-31T16:37:23-06:00' },
  { label: 'universal time', since: '2026-10-31T22:37:23.388Z' },
  { label: 'another time zone', since: '2026-10-31T18:37:23.388-04:00' },
]

export const UNREADABLE_START_CASES = [
  { label: 'an empty string', since: '' },
  { label: 'text that is not a date', since: 'banana' },
  { label: 'null', since: null },
  { label: 'undefined', since: undefined },
  { label: 'a number', since: 12345 },
]

// Who is logged out when they clock out
export const LOGOUT_ON_CLOCK_OUT_CASES = [
  { label: 'staff who are clocked in', user: { role: 'staff', clocked_in: true }, expected: true },
  { label: 'an admin who is clocked in', user: { role: 'admin', clocked_in: true }, expected: false },
  { label: 'staff with no clock status', user: { role: 'staff' }, expected: true },
  { label: 'a role spelled "Admin", which the server does not accept', user: { role: 'Admin', clocked_in: true }, expected: true },
  { label: 'a person with no role', user: { clocked_in: true }, expected: true },
  { label: 'no person at all', user: null, expected: true },
  { label: 'an undefined person', user: undefined, expected: true },
]

// People, as /me describes them
export const CLOCKED_IN_STAFF = {
  id: 'user-luke',
  full_name: 'Luke Skywalker',
  job_title: 'operator',
  role: 'staff',
  clocked_in: true,
  clocked_in_since: SINCE_TEXT,
}
export const CLOCKED_IN_ADMIN = {
  id: 'user-mon',
  full_name: 'Mon Mothma',
  job_title: 'superintendent',
  role: 'admin',
  clocked_in: true,
  clocked_in_since: SINCE_TEXT,
}
export const STAFF_OFF_THE_CLOCK = { ...CLOCKED_IN_STAFF, clocked_in: false, clocked_in_since: null }
export const ADMIN_OFF_THE_CLOCK = { ...CLOCKED_IN_ADMIN, clocked_in: false, clocked_in_since: null }
export const CLOCKED_IN_WITHOUT_START = { ...CLOCKED_IN_STAFF, clocked_in_since: null }

// What the clock-out question says, for each kind of person
export const CONFIRM_TEXT_CASES = [
  { label: 'staff', user: CLOCKED_IN_STAFF, expected: 'You will be logged out.' },
  { label: 'an admin', user: CLOCKED_IN_ADMIN, expected: 'You can keep using the app.' },
]