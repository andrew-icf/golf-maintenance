import { describe, expect, it } from 'vitest'
import { LOGOUT_ON_CLOCK_OUT_CASES } from '../../test/fixtures/clockControlCases'
import { GATE_STATUS_CASES } from '../../test/fixtures/clockGateCases'
import { isGated, logsOutOnClockOut } from './clockStatus'

describe('isGated', () => {
  it.each(GATE_STATUS_CASES)('says $expected for $label', ({ user, expected }) => {
    expect(isGated(user)).toBe(expected)
  })
})

describe('logsOutOnClockOut', () => {
  it.each(LOGOUT_ON_CLOCK_OUT_CASES)('says $expected for $label', ({ user, expected }) => {
    expect(logsOutOnClockOut(user)).toBe(expected)
  })
})