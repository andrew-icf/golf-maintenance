import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNow } from './useNow'

// Test data
const START = new Date(2026, 9, 31, 12, 0, 0)
const ONE_MINUTE_MS = 60 * 1000
const CUSTOM_INTERVAL_MS = 10 * 1000

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow())

    expect(result.current).toBe(START.getTime())
  })

  it('does not change before the minute is up', () => {
    const { result } = renderHook(() => useNow())

    act(() => {
      vi.advanceTimersByTime(ONE_MINUTE_MS - 1)
    })

    expect(result.current).toBe(START.getTime())
  })

  it('moves on by a minute each minute', () => {
    const { result } = renderHook(() => useNow())

    act(() => {
      vi.advanceTimersByTime(ONE_MINUTE_MS)
    })
    expect(result.current).toBe(START.getTime() + ONE_MINUTE_MS)

    act(() => {
      vi.advanceTimersByTime(ONE_MINUTE_MS)
    })
    expect(result.current).toBe(START.getTime() + 2 * ONE_MINUTE_MS)
  })

  it('uses the interval it is given', () => {
    const { result } = renderHook(() => useNow(CUSTOM_INTERVAL_MS))

    act(() => {
      vi.advanceTimersByTime(CUSTOM_INTERVAL_MS)
    })

    expect(result.current).toBe(START.getTime() + CUSTOM_INTERVAL_MS)
  })

  it('stops its timer when it is no longer shown', () => {
    const { unmount } = renderHook(() => useNow())
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})