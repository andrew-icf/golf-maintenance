// Test data for how often a task is due. Every day is written 'YYYY-MM-DD'.
export const ANCHOR = '2026-11-02' // a Monday

export const EVERY_OTHER_DAY = { type: 'every_n_days', every: 2, anchor: ANCHOR }
export const AS_NEEDED = { type: 'as_needed' }

function everyOtherDayFrom(anchor) {
  return { type: 'every_n_days', every: 2, anchor }
}

const EVERY_THREE_DAYS = { type: 'every_n_days', every: 3, anchor: ANCHOR }
export const EVERY_DAY_SCHEDULE = { type: 'every_n_days', every: 1, anchor: ANCHOR }
export const EVERY_DAY_DAYS = ['2026-11-02', '2026-11-03', '2026-12-31']

export const ORDINARY_DAYS = ['2026-11-02', '2026-11-03']

export const DAILY_DAYS = [
  { label: 'an ordinary day', day: '2026-11-02' },
  { label: 'the last day of the year', day: '2026-12-31' },
  { label: 'the first day of the year', day: '2027-01-01' },
  { label: 'a leap day', day: '2028-02-29' },
]

// Nothing that is a schedule counts as every day
export const UNKNOWN_FREQUENCY_CASES = [
  { label: 'nothing', frequency: undefined },
  { label: 'null', frequency: null },
  { label: 'an empty object', frequency: {} },
  { label: 'a type it does not know', frequency: { type: 'mystery' } },
  { label: 'text', frequency: 'every_n_days' },
]

// Every other day from a Monday, including across month ends, a new year, a leap day, and the
// two days a year the clocks change (which only bite in a time zone with daylight saving)
export const EVERY_OTHER_DAY_CASES = [
  { label: 'the day it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-02', expected: true },
  { label: 'the day after it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-03', expected: false },
  { label: 'two days after it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-04', expected: true },
  { label: 'three days after it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-05', expected: false },
  { label: 'the day before it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-01', expected: false },
  { label: 'two days before it starts', frequency: EVERY_OTHER_DAY, day: '2026-10-31', expected: true },
  { label: 'four weeks after it starts', frequency: EVERY_OTHER_DAY, day: '2026-11-30', expected: true },
  { label: 'the day after that, in the next month', frequency: EVERY_OTHER_DAY, day: '2026-12-01', expected: false },
  { label: 'a due day across the new year', frequency: everyOtherDayFrom('2026-12-30'), day: '2027-01-01', expected: true },
  { label: 'an off day across the new year', frequency: everyOtherDayFrom('2026-12-30'), day: '2027-01-02', expected: false },
  { label: 'a due day on a leap day', frequency: everyOtherDayFrom('2028-02-27'), day: '2028-02-29', expected: true },
  { label: 'an off day after a leap day', frequency: everyOtherDayFrom('2028-02-27'), day: '2028-03-01', expected: false },
  { label: 'a due day across the autumn clock change', frequency: everyOtherDayFrom('2026-10-31'), day: '2026-11-02', expected: true },
  { label: 'an off day on the autumn clock change', frequency: everyOtherDayFrom('2026-10-31'), day: '2026-11-01', expected: false },
  { label: 'a due day across the spring clock change', frequency: everyOtherDayFrom('2026-03-07'), day: '2026-03-09', expected: true },
  { label: 'an off day on the spring clock change', frequency: everyOtherDayFrom('2026-03-07'), day: '2026-03-08', expected: false },
  { label: 'a year after it starts, an odd number of days', frequency: EVERY_OTHER_DAY, day: '2027-11-02', expected: false },
  { label: 'a year and a day after it starts', frequency: EVERY_OTHER_DAY, day: '2027-11-03', expected: true },
]

export const EVERY_THREE_DAYS_CASES = [
  { label: 'three days after it starts', day: '2026-11-05', expected: true },
  { label: 'six days after it starts', day: '2026-11-08', expected: true },
  { label: 'the day after it starts', day: '2026-11-03', expected: false },
  { label: 'two days after it starts', day: '2026-11-04', expected: false },
  { label: 'three days before it starts', day: '2026-10-30', expected: true },
]

// Schedules that say "every N days" but do not say it properly, so the task counts as due every
// day. A real every-other-day schedule would say no on 2026-11-03.
export const INVALID_EVERY_N_DAYS_CASES = [
  { label: 'a count of zero', frequency: { type: 'every_n_days', every: 0, anchor: ANCHOR } },
  { label: 'a negative count', frequency: { type: 'every_n_days', every: -2, anchor: ANCHOR } },
  { label: 'a count that is a fraction', frequency: { type: 'every_n_days', every: 1.5, anchor: ANCHOR } },
  { label: 'a count written as text', frequency: { type: 'every_n_days', every: '2', anchor: ANCHOR } },
  { label: 'no count', frequency: { type: 'every_n_days', anchor: ANCHOR } },
  { label: 'no start day', frequency: { type: 'every_n_days', every: 2 } },
  { label: 'a start day that is not a date', frequency: { type: 'every_n_days', every: 2, anchor: 'banana' } },
  { label: 'a start day that is not a real day', frequency: { type: 'every_n_days', every: 2, anchor: '2026-13-45' } },
  { label: 'a start day that is a number', frequency: { type: 'every_n_days', every: 2, anchor: 20261102 } },
]

// Mondays and Thursdays, from the week of 2026-11-01 (a Sunday)
const MONDAYS_AND_THURSDAYS = { type: 'weekly', weekdays: [1, 4] }

export const WEEKLY_CASES = [
  { label: 'a Monday, when it is Mondays and Thursdays', frequency: MONDAYS_AND_THURSDAYS, day: '2026-11-02', expected: true },
  { label: 'a Thursday, when it is Mondays and Thursdays', frequency: MONDAYS_AND_THURSDAYS, day: '2026-11-05', expected: true },
  { label: 'a Tuesday, when it is Mondays and Thursdays', frequency: MONDAYS_AND_THURSDAYS, day: '2026-11-03', expected: false },
  { label: 'a Sunday, when it is Mondays and Thursdays', frequency: MONDAYS_AND_THURSDAYS, day: '2026-11-01', expected: false },
  { label: 'a Saturday, when it is Mondays and Thursdays', frequency: MONDAYS_AND_THURSDAYS, day: '2026-11-07', expected: false },
  { label: 'a Sunday, when it is Sundays only', frequency: { type: 'weekly', weekdays: [0] }, day: '2026-11-01', expected: true },
  { label: 'a Monday, when it is Sundays only', frequency: { type: 'weekly', weekdays: [0] }, day: '2026-11-02', expected: false },
  { label: 'a Saturday, when it is Saturdays only', frequency: { type: 'weekly', weekdays: [6] }, day: '2026-11-07', expected: true },
  {
    label: 'a Wednesday, when every weekday is picked',
    frequency: { type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] },
    day: '2026-11-04',
    expected: true,
  },
]

// Weekly schedules that do not name their days properly, so the task counts as due every day.
// A real Mondays-and-Thursdays schedule would say no on 2026-11-03.
export const INVALID_WEEKLY_CASES = [
  { label: 'an empty list of days', frequency: { type: 'weekly', weekdays: [] } },
  { label: 'a day past Saturday', frequency: { type: 'weekly', weekdays: [7] } },
  { label: 'a negative day', frequency: { type: 'weekly', weekdays: [-1] } },
  { label: 'a day that is a fraction', frequency: { type: 'weekly', weekdays: [1.5] } },
  { label: 'a day written as text', frequency: { type: 'weekly', weekdays: ['1'] } },
  { label: 'days written as one word', frequency: { type: 'weekly', weekdays: 'mon' } },
  { label: 'days that are null', frequency: { type: 'weekly', weekdays: null } },
  { label: 'no days at all', frequency: { type: 'weekly' } },
]

export const AS_NEEDED_CASES = [
  { label: 'a day it was scheduled for', scheduledDays: ['2026-11-03'], day: '2026-11-03', expected: true },
  { label: 'a day it was not scheduled for', scheduledDays: ['2026-11-03'], day: '2026-11-02', expected: false },
  {
    label: 'one of several days it was scheduled for',
    scheduledDays: ['2026-11-02', '2026-11-09', '2026-11-16'],
    day: '2026-11-09',
    expected: true,
  },
  { label: 'no schedule given at all', scheduledDays: undefined, day: '2026-11-03', expected: false },
  { label: 'a schedule that is null', scheduledDays: null, day: '2026-11-03', expected: false },
  { label: 'a schedule that is text, not a list', scheduledDays: '2026-11-03', day: '2026-11-03', expected: false },
]

// Days that cannot be read, so the task counts as due, since it cannot tell
export const UNREADABLE_DAY_CASES = [
  { label: 'nothing', day: undefined },
  { label: 'an empty string', day: '' },
  { label: 'text that is not a date', day: 'banana' },
  { label: 'a date that is not a real day', day: '2026-13-45' },
  { label: 'a number', day: 20261102 },
]

// Frozen, so any attempt to change it in place throws
export const FROZEN_SCHEDULED_DAYS = Object.freeze(['2026-11-03', '2026-11-10'])

export const DESCRIBE_FREQUENCY_CASES = [
  { label: 'every day', frequency: { type: 'daily' }, expected: '' },
  { label: 'nothing', frequency: undefined, expected: '' },
  { label: 'null', frequency: null, expected: '' },
  { label: 'a type it does not know', frequency: { type: 'mystery' }, expected: '' },
  { label: 'every other day', frequency: EVERY_OTHER_DAY, expected: 'Every other day' },
  { label: 'every three days', frequency: EVERY_THREE_DAYS, expected: 'Every 3 days' },
  { label: 'every seven days', frequency: { type: 'every_n_days', every: 7, anchor: ANCHOR }, expected: 'Every 7 days' },
  { label: 'every one day, which is every day', frequency: EVERY_DAY_SCHEDULE, expected: '' },
  { label: 'a count of zero', frequency: { type: 'every_n_days', every: 0, anchor: ANCHOR }, expected: '' },
  { label: 'a count that is a fraction', frequency: { type: 'every_n_days', every: 1.5, anchor: ANCHOR }, expected: '' },
  { label: 'a count written as text', frequency: { type: 'every_n_days', every: '2', anchor: ANCHOR }, expected: '' },
  { label: 'every other day with no start day', frequency: { type: 'every_n_days', every: 2 }, expected: '' },
  { label: 'one weekday', frequency: { type: 'weekly', weekdays: [1] }, expected: 'Weekly on Mon' },
  { label: 'two weekdays', frequency: { type: 'weekly', weekdays: [1, 4] }, expected: 'Weekly on Mon and Thu' },
  { label: 'three weekdays', frequency: { type: 'weekly', weekdays: [1, 3, 5] }, expected: 'Weekly on Mon, Wed, and Fri' },
  { label: 'three weekdays out of order', frequency: { type: 'weekly', weekdays: [5, 1, 3] }, expected: 'Weekly on Mon, Wed, and Fri' },
  { label: 'a weekday listed twice', frequency: { type: 'weekly', weekdays: [1, 1] }, expected: 'Weekly on Mon' },
  { label: 'every weekday, which is every day', frequency: { type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] }, expected: '' },
  { label: 'an empty list of weekdays', frequency: { type: 'weekly', weekdays: [] }, expected: '' },
  { label: 'a weekday past Saturday', frequency: { type: 'weekly', weekdays: [7] }, expected: '' },
  { label: 'as needed', frequency: AS_NEEDED, expected: 'As needed' },
]