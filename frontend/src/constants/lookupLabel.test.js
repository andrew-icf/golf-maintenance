import { describe, expect, it } from 'vitest'
import { lookupLabel } from './lookupLabel'

// Test data
const LABELS = { first: 'First Label', second: 'Second Label' }

const UNKNOWN_TEXT_CASES = [
  { label: 'an unknown name', value: 'forklift' },
  { label: 'a name every object inherits', value: 'constructor' },
  { label: 'another inherited name', value: 'toString' },
  { label: 'the prototype key', value: '__proto__' },
  { label: 'a known name in the wrong case', value: 'FIRST' },
]

const NOT_TEXT_CASES = [
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
  { label: 'a number', value: 42 },
  { label: 'a boolean', value: true },
  { label: 'an object', value: {} },
]

describe('lookupLabel', () => {
  it('returns the label for a known value', () => {
    expect(lookupLabel(LABELS, 'first')).toBe('First Label')
    expect(lookupLabel(LABELS, 'second')).toBe('Second Label')
  })

  it.each(UNKNOWN_TEXT_CASES)('returns $label exactly as it arrived', ({ value }) => {
    expect(lookupLabel(LABELS, value)).toBe(value)
  })

  it('returns an empty string for an empty string', () => {
    expect(lookupLabel(LABELS, '')).toBe('')
  })

  it.each(NOT_TEXT_CASES)('shows nothing for $label', ({ value }) => {
    expect(lookupLabel(LABELS, value)).toBe('')
  })
})