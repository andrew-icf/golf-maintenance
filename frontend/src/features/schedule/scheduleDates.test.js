import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  addWeeks,
  formatDateString,
  formatDayLabel,
  formatShiftRange,
  formatShiftTime,
  formatWeekRange,
  getWeekDates,
  getWeekStart,
  parseDateString,
  todayDateString,
} from './scheduleDates'

// Test data. 2026-10-04 is a Sunday, and weeks run Sunday to Saturday.
const SUNDAY = '2026-10-04'
const MONDAY = '2026-10-05'
const WEDNESDAY = '2026-10-07'
const SATURDAY = '2026-10-10'

// Built from local calendar fields, the same way the app reads "today"
const LATE_EVENING = new Date(2026, 9, 5, 23, 30)
const JUST_AFTER_MIDNIGHT = new Date(2026, 9, 6, 0, 30)

const ROUND_TRIP_DATES = ['2026-01-01', '2026-03-05', '2026-12-31', '2028-02-29']

const ADD_DAYS_CASES = [
  { label: 'moves forward within a month', startDate: '2026-10-04', dayCount: 3, expected: '2026-10-07' },
  { label: 'moves backward within a month', startDate: '2026-10-04', dayCount: -3, expected: '2026-10-01' },
  { label: 'does nothing for zero days', startDate: '2026-10-04', dayCount: 0, expected: '2026-10-04' },
  { label: 'rolls over a month end', startDate: '2026-10-31', dayCount: 1, expected: '2026-11-01' },
  { label: 'rolls back over a month start', startDate: '2026-11-01', dayCount: -1, expected: '2026-10-31' },
  { label: 'rolls over a year end', startDate: '2026-12-31', dayCount: 1, expected: '2027-01-01' },
  { label: 'rolls back over a year start', startDate: '2027-01-01', dayCount: -1, expected: '2026-12-31' },
  { label: 'ends February on the 28th in a normal year', startDate: '2026-02-28', dayCount: 1, expected: '2026-03-01' },
  { label: 'includes the leap day', startDate: '2028-02-28', dayCount: 1, expected: '2028-02-29' },
  { label: 'moves past the leap day', startDate: '2028-02-29', dayCount: 1, expected: '2028-03-01' },
  { label: 'crosses the November clock change', startDate: '2026-10-31', dayCount: 2, expected: '2026-11-02' },
]

const ADD_WEEKS_CASES = [
  { label: 'moves forward one week', startDate: '2026-10-04', weekCount: 1, expected: '2026-10-11' },
  { label: 'moves back one week', startDate: '2026-10-04', weekCount: -1, expected: '2026-09-27' },
  { label: 'crosses a month end', startDate: '2026-10-25', weekCount: 1, expected: '2026-11-01' },
  { label: 'does nothing for zero weeks', startDate: '2026-10-04', weekCount: 0, expected: '2026-10-04' },
]

const WEEK_START_CASES = [
  { label: 'keeps a Sunday as it is', date: SUNDAY, expected: SUNDAY },
  { label: 'goes back one day from a Monday', date: MONDAY, expected: SUNDAY },
  { label: 'goes back three days from a Wednesday', date: WEDNESDAY, expected: SUNDAY },
  { label: 'goes back six days from a Saturday', date: SATURDAY, expected: SUNDAY },
  { label: 'reaches into the previous month', date: '2026-12-02', expected: '2026-11-29' },
  { label: 'reaches into the previous year', date: '2027-01-01', expected: '2026-12-27' },
]

const WEEK_DATES_CASES = [
  {
    label: 'lists seven days starting on a Sunday',
    weekStart: SUNDAY,
    expected: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'],
  },
  {
    label: 'continues across a month boundary',
    weekStart: '2026-11-29',
    expected: ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'],
  },
  {
    label: 'continues across a year boundary',
    weekStart: '2026-12-27',
    expected: ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
  },
  {
    label: 'lists every day of the week the clocks change',
    weekStart: '2026-11-01',
    expected: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
  },
]

const DAY_LABEL_CASES = [
  { label: 'a Sunday', date: SUNDAY, expected: { weekday: 'Sun', monthDay: '10/04' } },
  { label: 'a Saturday', date: SATURDAY, expected: { weekday: 'Sat', monthDay: '10/10' } },
  { label: 'a single-digit month and day, padded', date: '2026-03-05', expected: { weekday: 'Thu', monthDay: '03/05' } },
  { label: 'the last day of the year', date: '2026-12-31', expected: { weekday: 'Thu', monthDay: '12/31' } },
  // A UTC-based parse shows this as Sunday 10/04 anywhere west of Greenwich
  { label: 'a Monday, which must not slip back to Sunday', date: MONDAY, expected: { weekday: 'Mon', monthDay: '10/05' } },
]

const WEEK_RANGE_CASES = [
  { label: 'within one month', weekStart: SUNDAY, expected: 'Oct 4 – Oct 10, 2026' },
  { label: 'across a month boundary', weekStart: '2026-11-29', expected: 'Nov 29 – Dec 5, 2026' },
  { label: 'across a year boundary', weekStart: '2026-12-27', expected: 'Dec 27, 2026 – Jan 2, 2027' },
]

const SHIFT_TIME_CASES = [
  { label: 'an early morning hour', time: '04:00:00', expected: '4am' },
  { label: 'an afternoon hour', time: '13:00:00', expected: '1pm' },
  { label: 'noon', time: '12:00:00', expected: '12pm' },
  { label: 'midnight', time: '00:00:00', expected: '12am' },
  { label: 'half past noon', time: '12:30:00', expected: '12:30pm' },
  { label: 'a quarter past midnight', time: '00:15:00', expected: '12:15am' },
  { label: 'a half hour in the afternoon', time: '13:30:00', expected: '1:30pm' },
  { label: 'minutes in the morning', time: '07:15:00', expected: '7:15am' },
  { label: 'the last minute of the day', time: '23:59:00', expected: '11:59pm' },
  { label: 'a time without seconds, as the shift form sends it', time: '07:00', expected: '7am' },
]

const SHIFT_RANGE_CASES = [
  { label: 'a morning to afternoon shift', startTime: '04:00:00', endTime: '13:00:00', expected: '4am – 1pm' },
  { label: 'a shift with minutes', startTime: '07:30:00', endTime: '15:45:00', expected: '7:30am – 3:45pm' },
  { label: 'a shift ending at noon', startTime: '09:00:00', endTime: '12:00:00', expected: '9am – 12pm' },
]

describe('parseDateString', () => {
  it('builds the calendar date in local time, never shifted by the timezone', () => {
    const date = parseDateString(MONDAY)

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(9)
    expect(date.getDate()).toBe(5)
    expect(date.getHours()).toBe(0)
  })
})

describe('formatDateString', () => {
  it('pads single-digit months and days', () => {
    expect(formatDateString(new Date(2026, 2, 5))).toBe('2026-03-05')
  })

  it.each(ROUND_TRIP_DATES)('round-trips %s through parse and format', (dateString) => {
    expect(formatDateString(parseDateString(dateString))).toBe(dateString)
  })
})

describe('todayDateString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the local date late in the evening', () => {
    vi.useFakeTimers()
    vi.setSystemTime(LATE_EVENING)

    expect(todayDateString()).toBe('2026-10-05')
  })

  it('uses the local date just after midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(JUST_AFTER_MIDNIGHT)

    expect(todayDateString()).toBe('2026-10-06')
  })
})

describe('addDays', () => {
  it.each(ADD_DAYS_CASES)('$label', ({ startDate, dayCount, expected }) => {
    expect(addDays(startDate, dayCount)).toBe(expected)
  })
})

describe('addWeeks', () => {
  it.each(ADD_WEEKS_CASES)('$label', ({ startDate, weekCount, expected }) => {
    expect(addWeeks(startDate, weekCount)).toBe(expected)
  })
})

describe('getWeekStart', () => {
  it.each(WEEK_START_CASES)('$label', ({ date, expected }) => {
    expect(getWeekStart(date)).toBe(expected)
  })

  it('always lands on a Sunday and contains the day it started from, for every day of 2026 and 2027', () => {
    for (let dayOffset = 0; dayOffset < 730; dayOffset++) {
      const day = addDays('2026-01-01', dayOffset)
      const weekStart = getWeekStart(day)

      expect(parseDateString(weekStart).getDay(), `week start for ${day}`).toBe(0)
      expect(getWeekDates(weekStart), `week containing ${day}`).toContain(day)
    }
  })
})

describe('getWeekDates', () => {
  it.each(WEEK_DATES_CASES)('$label', ({ weekStart, expected }) => {
    expect(getWeekDates(weekStart)).toEqual(expected)
  })
})

describe('formatDayLabel', () => {
  it.each(DAY_LABEL_CASES)('formats $label', ({ date, expected }) => {
    expect(formatDayLabel(date)).toEqual(expected)
  })
})

describe('formatWeekRange', () => {
  it.each(WEEK_RANGE_CASES)('formats a week $label', ({ weekStart, expected }) => {
    expect(formatWeekRange(weekStart)).toBe(expected)
  })
})

describe('formatShiftTime', () => {
  it.each(SHIFT_TIME_CASES)('formats $label', ({ time, expected }) => {
    expect(formatShiftTime(time)).toBe(expected)
  })
})

describe('formatShiftRange', () => {
  it.each(SHIFT_RANGE_CASES)('formats $label', ({ startTime, endTime, expected }) => {
    expect(formatShiftRange(startTime, endTime)).toBe(expected)
  })
})