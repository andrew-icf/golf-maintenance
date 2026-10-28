import { describe, expect, it } from 'vitest'
import { AMENITY_TYPE_LABELS, formatAmenityType } from './amenities'

// Test data
const TYPE_LABEL_CASES = [
  { type: 'clubhouse', label: 'Clubhouse' },
  { type: 'driving_range', label: 'Driving range' },
  { type: 'comfort_station', label: 'Comfort station' },
  { type: 'pool', label: 'Pool' },
  { type: 'tennis_court', label: 'Tennis court' },
]

const UNKNOWN_VALUE_CASES = [
  { label: 'an unknown name', value: 'putting_green', expected: 'putting_green' },
  { label: 'a name every object inherits', value: 'constructor', expected: 'constructor' },
  { label: 'an empty string', value: '', expected: '' },
  { label: 'null', value: null, expected: '' },
  { label: 'undefined', value: undefined, expected: '' },
]

describe('amenity type labels', () => {
  it('covers exactly the types the app knows', () => {
    expect(Object.keys(AMENITY_TYPE_LABELS).sort()).toEqual(
      TYPE_LABEL_CASES.map(({ type }) => type).sort()
    )
  })

  it.each(TYPE_LABEL_CASES)('writes $type as "$label"', ({ type, label }) => {
    expect(formatAmenityType(type)).toBe(label)
  })

  it('has a different label for every type', () => {
    const labels = Object.values(AMENITY_TYPE_LABELS)

    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('formatAmenityType with a value it has no label for', () => {
  it.each(UNKNOWN_VALUE_CASES)('handles $label', ({ value, expected }) => {
    expect(formatAmenityType(value)).toBe(expected)
  })
})