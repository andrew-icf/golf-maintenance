import { describe, expect, it } from 'vitest'
import { GATE_STATUS_CASES } from '../../test/fixtures/clockGateCases'
import { isGated } from './clockStatus'

describe('isGated', () => {
  it.each(GATE_STATUS_CASES)('says $expected for $label', ({ user, expected }) => {
    expect(isGated(user)).toBe(expected)
  })
})