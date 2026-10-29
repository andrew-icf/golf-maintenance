import { describe, expect, it } from 'vitest'
import { matchPath } from 'react-router-dom'
import { HOLE_ROUTE_PATTERN, holePath } from './holePath'

// Test data
const PATH_CASES = [
  { label: 'a uuid', holeId: '3f2a9c1e-5b7d-4e08-9a41-c6d2e8f01b73', expected: '/course/holes/3f2a9c1e-5b7d-4e08-9a41-c6d2e8f01b73' },
  { label: 'a short id', holeId: 'hole-C7', expected: '/course/holes/hole-C7' },
  { label: 'an id with a space', holeId: 'hole C7', expected: '/course/holes/hole%20C7' },
  { label: 'an id with a slash', holeId: 'hole/C7', expected: '/course/holes/hole%2FC7' },
  { label: 'an id with a question mark', holeId: 'hole?C7', expected: '/course/holes/hole%3FC7' },
  { label: 'an id with a hash', holeId: 'hole#C7', expected: '/course/holes/hole%23C7' },
  { label: 'an id with a percent sign', holeId: '100%C7', expected: '/course/holes/100%25C7' },
]

// Ids as the database makes them, which need no encoding
const ROUND_TRIP_CASES = [
  { label: 'a uuid', holeId: '3f2a9c1e-5b7d-4e08-9a41-c6d2e8f01b73' },
  { label: 'a short id', holeId: 'hole-C7' },
]

describe('holePath', () => {
  it.each(PATH_CASES)('builds the address for $label', ({ holeId, expected }) => {
    expect(holePath(holeId)).toBe(expected)
  })

  it.each(ROUND_TRIP_CASES)('gives an address the details route reads back as the same id, for $label', ({ holeId }) => {
    const match = matchPath(HOLE_ROUTE_PATTERN, holePath(holeId))

    expect(match).not.toBeNull()
    expect(match.params.holeId).toBe(holeId)
  })
})