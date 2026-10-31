// Test data for building a person's own days from the shifts /api/my-schedule sends.
// Today is Wednesday 2026-10-21.

const LUKE_ID = 'user-luke'
const LUKE_NAME = 'Luke Skywalker'

export const TODAY = '2026-10-21'
export const WEEK_START = '2026-10-18'
export const DAYS_IN_WEEK = 7

// A shift as the server sends it
export function makeShift(id, shiftDate, startTime, endTime) {
  return {
    id,
    user_id: LUKE_ID,
    full_name: LUKE_NAME,
    shift_date: shiftDate,
    start_time: startTime,
    end_time: endTime,
  }
}

// Luke works Monday to Wednesday and Friday, 7am to 3:30pm, and is off the other days.
// The shifts arrive out of order on purpose, so a shift can only land on the right day by date.
export const LUKE_WEEK_SHIFTS = [
  makeShift('shift-fri', '2026-10-23', '07:00:00', '15:30:00'),
  makeShift('shift-mon', '2026-10-19', '07:00:00', '15:30:00'),
  makeShift('shift-wed', '2026-10-21', '07:00:00', '15:30:00'),
  makeShift('shift-tue', '2026-10-20', '07:00:00', '15:30:00'),
]
export const LUKE_WEEK_TEXTS = [
  [],
  ['7am – 3:30pm'],
  ['7am – 3:30pm'],
  ['7am – 3:30pm'],
  [],
  ['7am – 3:30pm'],
  [],
]
export const LUKE_WEEK_IDS = [[], ['shift-mon'], ['shift-tue'], ['shift-wed'], [], ['shift-fri'], []]

// Two shifts on Thursday, given late one first
export const SPLIT_DAY_DATE = '2026-10-22'
export const SPLIT_DAY_SHIFTS = [
  makeShift('split-late', SPLIT_DAY_DATE, '12:00:00', '16:00:00'),
  makeShift('split-early', SPLIT_DAY_DATE, '06:00:00', '10:00:00'),
]
export const SPLIT_DAY_TEXTS = ['6am – 10am', '12pm – 4pm']
export const SPLIT_DAY_IDS = ['split-early', 'split-late']

export const MINUTES_SHIFT_DATE = '2026-10-20'
export const MINUTES_SHIFT = makeShift('shift-minutes', MINUTES_SHIFT_DATE, '06:30:00', '14:45:00')
export const MINUTES_SHIFT_TEXT = '6:30am – 2:45pm'

// One day before the week starts and one day after it ends
export const OUTSIDE_WINDOW_SHIFTS = [
  makeShift('too-early', '2026-10-17', '07:00:00', '15:30:00'),
  makeShift('too-late', '2026-10-25', '07:00:00', '15:30:00'),
]

// Frozen, so any attempt to reorder or change them in place throws
export const FROZEN_SPLIT_DAY_SHIFTS = Object.freeze(
  SPLIT_DAY_SHIFTS.map((shift) => Object.freeze({ ...shift }))
)

// Windows of days, including ones that cross a month end, a new year, and a leap day
export const WINDOW_CASES = [
  {
    label: 'a week starting on a Sunday',
    startDate: '2026-10-18',
    dayCount: 7,
    expectedDates: ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'],
    expectedWeekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    expectedMonthDays: ['10/18', '10/19', '10/20', '10/21', '10/22', '10/23', '10/24'],
  },
  {
    label: 'seven days starting midweek',
    startDate: '2026-10-21',
    dayCount: 7,
    expectedDates: ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
    expectedWeekdays: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'],
    expectedMonthDays: ['10/21', '10/22', '10/23', '10/24', '10/25', '10/26', '10/27'],
  },
  {
    label: 'a window across a month end',
    startDate: '2026-10-29',
    dayCount: 5,
    expectedDates: ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
    expectedWeekdays: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    expectedMonthDays: ['10/29', '10/30', '10/31', '11/01', '11/02'],
  },
  {
    label: 'a window across the new year',
    startDate: '2026-12-29',
    dayCount: 7,
    expectedDates: ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04'],
    expectedWeekdays: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    expectedMonthDays: ['12/29', '12/30', '12/31', '01/01', '01/02', '01/03', '01/04'],
  },
  {
    label: 'a window over a leap day',
    startDate: '2028-02-27',
    dayCount: 4,
    expectedDates: ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'],
    expectedWeekdays: ['Sun', 'Mon', 'Tue', 'Wed'],
    expectedMonthDays: ['02/27', '02/28', '02/29', '03/01'],
  },
  {
    label: 'a single day',
    startDate: '2026-10-21',
    dayCount: 1,
    expectedDates: ['2026-10-21'],
    expectedWeekdays: ['Wed'],
    expectedMonthDays: ['10/21'],
  },
]

// Day counts that make no sense, so there are no days to show
export const INVALID_DAY_COUNT_CASES = [
  { label: 'zero', dayCount: 0 },
  { label: 'a negative number', dayCount: -1 },
  { label: 'a fraction', dayCount: 2.5 },
  { label: 'not a number', dayCount: NaN },
  { label: 'missing', dayCount: undefined },
  { label: 'text', dayCount: '7' },
]

export const NO_SHIFTS_CASES = [
  { label: 'null', shifts: null },
  { label: 'undefined', shifts: undefined },
  { label: 'an empty list', shifts: [] },
]

// What todaysShifts returns for each situation
export const TODAYS_SHIFTS_CASES = [
  {
    label: 'a day with one shift',
    shifts: LUKE_WEEK_SHIFTS,
    startDate: WEEK_START,
    today: TODAY,
    expectedTexts: ['7am – 3:30pm'],
  },
  {
    label: 'a day off',
    shifts: LUKE_WEEK_SHIFTS,
    startDate: WEEK_START,
    today: '2026-10-22',
    expectedTexts: [],
  },
  {
    label: 'a split day, in start-time order',
    shifts: SPLIT_DAY_SHIFTS,
    startDate: WEEK_START,
    today: SPLIT_DAY_DATE,
    expectedTexts: SPLIT_DAY_TEXTS,
  },
  {
    label: 'a window that does not include today',
    shifts: LUKE_WEEK_SHIFTS,
    startDate: '2026-10-25',
    today: TODAY,
    expectedTexts: [],
  },
]