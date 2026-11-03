import { describe, expect, it } from 'vitest'
import {
  AS_NEEDED,
  AS_NEEDED_CASES,
  DAILY_DAYS,
  DESCRIBE_FREQUENCY_CASES,
  EVERY_DAY_DAYS,
  EVERY_DAY_SCHEDULE,
  EVERY_OTHER_DAY,
  EVERY_OTHER_DAY_CASES,
  EVERY_THREE_DAYS_CASES,
  FROZEN_SCHEDULED_DAYS,
  INVALID_EVERY_N_DAYS_CASES,
  INVALID_WEEKLY_CASES,
  ORDINARY_DAYS,
  UNKNOWN_FREQUENCY_CASES,
  UNREADABLE_DAY_CASES,
  WEEKLY_CASES,
} from '../../../test/fixtures/frequencyCases'
import { DAILY, describeFrequency, isDueOn } from './checklistFrequency'

// A real schedule of every three days, from the same Monday the cases use
const EVERY_THREE_DAYS = { type: 'every_n_days', every: 3, anchor: '2026-11-02' }
// A day that a real every-other-day or Mondays-and-Thursdays schedule would say no on
const OFF_DAY = '2026-11-03'

describe('isDueOn', () => {
  it.each(DAILY_DAYS)('is due on $label when it is daily', ({ day }) => {
    expect(isDueOn(DAILY, day)).toBe(true)
  })

  it.each(UNKNOWN_FREQUENCY_CASES)('is due every day when its schedule is $label', ({ frequency }) => {
    for (const day of ORDINARY_DAYS) {
      expect(isDueOn(frequency, day), day).toBe(true)
    }
  })

  it.each(EVERY_OTHER_DAY_CASES)('says $expected for $label', ({ frequency, day, expected }) => {
    expect(isDueOn(frequency, day)).toBe(expected)
  })

  it.each(EVERY_THREE_DAYS_CASES)('says $expected for $label, when it is every three days', ({ day, expected }) => {
    expect(isDueOn(EVERY_THREE_DAYS, day)).toBe(expected)
  })

  it('is due every day when it repeats every one day', () => {
    for (const day of EVERY_DAY_DAYS) {
      expect(isDueOn(EVERY_DAY_SCHEDULE, day), day).toBe(true)
    }
  })

  it.each(INVALID_EVERY_N_DAYS_CASES)('is due every day when its schedule has $label', ({ frequency }) => {
    expect(isDueOn(frequency, OFF_DAY)).toBe(true)
    expect(isDueOn(frequency, '2026-11-02')).toBe(true)
  })

  it.each(WEEKLY_CASES)('says $expected for $label', ({ frequency, day, expected }) => {
    expect(isDueOn(frequency, day)).toBe(expected)
  })

  it.each(INVALID_WEEKLY_CASES)('is due every day when its schedule has $label', ({ frequency }) => {
    expect(isDueOn(frequency, OFF_DAY)).toBe(true)
  })

  it.each(AS_NEEDED_CASES)('says $expected for $label, when it is as needed', ({ scheduledDays, day, expected }) => {
    expect(isDueOn(AS_NEEDED, day, scheduledDays)).toBe(expected)
  })

  it.each(UNREADABLE_DAY_CASES)('is due on a day that is $label, since it cannot tell', ({ day }) => {
    expect(isDueOn(EVERY_OTHER_DAY, day)).toBe(true)
    expect(isDueOn(AS_NEEDED, day)).toBe(true)
  })

  it('does not modify the list of scheduled days it is given', () => {
    expect(() => isDueOn(AS_NEEDED, '2026-11-03', FROZEN_SCHEDULED_DAYS)).not.toThrow()
    expect(isDueOn(AS_NEEDED, '2026-11-03', FROZEN_SCHEDULED_DAYS)).toBe(true)
  })
})

describe('describeFrequency', () => {
  it.each(DESCRIBE_FREQUENCY_CASES)('writes $label as "$expected"', ({ frequency, expected }) => {
    expect(describeFrequency(frequency)).toBe(expected)
  })
})