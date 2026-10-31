import { describe, expect, it } from 'vitest'
import {
  DAYS_IN_WEEK,
  FROZEN_SPLIT_DAY_SHIFTS,
  INVALID_DAY_COUNT_CASES,
  LUKE_WEEK_IDS,
  LUKE_WEEK_SHIFTS,
  LUKE_WEEK_TEXTS,
  MINUTES_SHIFT,
  MINUTES_SHIFT_DATE,
  MINUTES_SHIFT_TEXT,
  NO_SHIFTS_CASES,
  OUTSIDE_WINDOW_SHIFTS,
  SPLIT_DAY_DATE,
  SPLIT_DAY_IDS,
  SPLIT_DAY_SHIFTS,
  SPLIT_DAY_TEXTS,
  TODAY,
  TODAYS_SHIFTS_CASES,
  WEEK_START,
  WINDOW_CASES,
} from '../../test/fixtures/myShiftsCases'
import { buildShiftDays, todaysShifts } from './myShifts'

// Actions
function weekOf(shifts, today = TODAY) {
  return buildShiftDays(shifts, WEEK_START, DAYS_IN_WEEK, today)
}

function dayOn(days, date) {
  return days.find((day) => day.date === date)
}

describe('buildShiftDays', () => {
  it.each(WINDOW_CASES)(
    'lays out $label',
    ({ startDate, dayCount, expectedDates, expectedWeekdays, expectedMonthDays }) => {
      const days = buildShiftDays([], startDate, dayCount, TODAY)

      expect(days.map((day) => day.date)).toEqual(expectedDates)
      expect(days.map((day) => day.weekday)).toEqual(expectedWeekdays)
      expect(days.map((day) => day.monthDay)).toEqual(expectedMonthDays)
    }
  )

  it('marks only today', () => {
    const days = weekOf(LUKE_WEEK_SHIFTS)

    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual([TODAY])
  })

  it('marks no day when today is outside the window', () => {
    const days = weekOf(LUKE_WEEK_SHIFTS, '2026-11-15')

    expect(days.some((day) => day.isToday)).toBe(false)
  })

  it('puts each shift on its own day with its time, whatever order they arrive in', () => {
    const days = weekOf(LUKE_WEEK_SHIFTS)

    expect(days.map((day) => day.shifts.map((shift) => shift.text))).toEqual(LUKE_WEEK_TEXTS)
  })

  it("carries each shift's id, for the screen to tell them apart", () => {
    const days = weekOf(LUKE_WEEK_SHIFTS)

    expect(days.map((day) => day.shifts.map((shift) => shift.id))).toEqual(LUKE_WEEK_IDS)
  })

  it('puts the shifts of a split day in start-time order', () => {
    const splitDay = dayOn(weekOf(SPLIT_DAY_SHIFTS), SPLIT_DAY_DATE)

    expect(splitDay.shifts.map((shift) => shift.text)).toEqual(SPLIT_DAY_TEXTS)
    expect(splitDay.shifts.map((shift) => shift.id)).toEqual(SPLIT_DAY_IDS)
  })

  it('shows minutes when a shift has them', () => {
    const day = dayOn(weekOf([MINUTES_SHIFT]), MINUTES_SHIFT_DATE)

    expect(day.shifts.map((shift) => shift.text)).toEqual([MINUTES_SHIFT_TEXT])
  })

  it('leaves out shifts that fall outside the window', () => {
    const days = weekOf(OUTSIDE_WINDOW_SHIFTS)

    expect(days).toHaveLength(DAYS_IN_WEEK)
    for (const day of days) {
      expect(day.shifts).toEqual([])
    }
  })

  it.each(INVALID_DAY_COUNT_CASES)('returns no days for a day count of $label', ({ dayCount }) => {
    expect(buildShiftDays(LUKE_WEEK_SHIFTS, WEEK_START, dayCount, TODAY)).toEqual([])
  })

  it.each(NO_SHIFTS_CASES)('returns a week of empty days for $label', ({ shifts }) => {
    const days = weekOf(shifts)

    expect(days).toHaveLength(DAYS_IN_WEEK)
    for (const day of days) {
      expect(day.shifts).toEqual([])
    }
  })

  it('does not modify the shifts it is given', () => {
    const splitDay = dayOn(weekOf(FROZEN_SPLIT_DAY_SHIFTS), SPLIT_DAY_DATE)

    expect(splitDay.shifts.map((shift) => shift.id)).toEqual(SPLIT_DAY_IDS)
    expect(FROZEN_SPLIT_DAY_SHIFTS.map((shift) => shift.id)).toEqual(['split-late', 'split-early'])
  })
})

describe('todaysShifts', () => {
  it.each(TODAYS_SHIFTS_CASES)(
    'returns the shifts for $label',
    ({ shifts, startDate, today, expectedTexts }) => {
      const days = buildShiftDays(shifts, startDate, DAYS_IN_WEEK, today)

      expect(todaysShifts(days).map((shift) => shift.text)).toEqual(expectedTexts)
    }
  )

  it('returns no shifts when there are no days', () => {
    expect(todaysShifts([])).toEqual([])
  })
})