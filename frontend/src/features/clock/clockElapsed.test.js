import { describe, expect, it } from 'vitest'
import {
  ELAPSED_CASES,
  SEVEN_MINUTES_LATER_MS,
  SINCE_MS,
  SINCE_TEXT,
  TIMESTAMP_SPELLING_CASES,
  UNREADABLE_START_CASES,
} from '../../test/fixtures/clockControlCases'
import { formatElapsed } from './clockElapsed'

describe('formatElapsed', () => {
  it.each(ELAPSED_CASES)('says $expected for $label', ({ nowMs, expected }) => {
    expect(formatElapsed(SINCE_TEXT, nowMs)).toBe(expected)
  })

  it.each(TIMESTAMP_SPELLING_CASES)('reads a start time written as $label', ({ since }) => {
    expect(formatElapsed(since, SEVEN_MINUTES_LATER_MS)).toBe('7m')
  })

  it.each(UNREADABLE_START_CASES)('says nothing for a start time of $label', ({ since }) => {
    expect(formatElapsed(since, SINCE_MS)).toBe('')
  })
})