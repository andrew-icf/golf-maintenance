import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  CUSTOM_FALLBACK_MESSAGE,
  DEFAULT_FAILURE_MESSAGE,
  FAILURE_MESSAGE,
  MESSAGELESS_FAILURE_CASES,
} from '../test/fixtures/asyncActionCases'
import { createDeferred } from '../test/helpers'
import { useAsyncAction } from './useAsyncAction'

// Actions
function renderAction(action, fallbackMessage) {
  return renderHook(() => useAsyncAction(action, fallbackMessage))
}

async function runOnce(result) {
  await act(async () => {
    await result.current.run()
  })
}

describe('useAsyncAction', () => {
  it('starts idle, with no error', () => {
    const { result } = renderAction(vi.fn())

    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('is running while the action is on its way, then idle again', async () => {
    const pending = createDeferred()
    const { result } = renderAction(() => pending.promise)

    let finished
    act(() => {
      finished = result.current.run()
    })
    expect(result.current.isRunning).toBe(true)

    await act(async () => {
      pending.resolve()
      await finished
    })
    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('calls the action once each time it runs', async () => {
    const action = vi.fn().mockResolvedValue()
    const { result } = renderAction(action)

    await runOnce(result)
    await runOnce(result)

    expect(action).toHaveBeenCalledTimes(2)
  })

  it('keeps the failure message, and stops running, when the action fails', async () => {
    const { result } = renderAction(vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)))

    await runOnce(result)

    expect(result.current.error).toBe(FAILURE_MESSAGE)
    expect(result.current.isRunning).toBe(false)
  })

  it('does not throw when the action fails', async () => {
    const { result } = renderAction(vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)))

    await act(async () => {
      await expect(result.current.run()).resolves.toBeUndefined()
    })
  })

  it.each(MESSAGELESS_FAILURE_CASES)(
    'falls back to the default message when the failure is $label',
    async ({ failure }) => {
      const { result } = renderAction(vi.fn().mockRejectedValue(failure))

      await runOnce(result)

      expect(result.current.error).toBe(DEFAULT_FAILURE_MESSAGE)
    }
  )

  it('uses the fallback message it is given', async () => {
    const { result } = renderAction(vi.fn().mockRejectedValue(undefined), CUSTOM_FALLBACK_MESSAGE)

    await runOnce(result)

    expect(result.current.error).toBe(CUSTOM_FALLBACK_MESSAGE)
  })

  it('clears an earlier error when it runs again', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error(FAILURE_MESSAGE))
      .mockResolvedValue()
    const { result } = renderAction(action)
    await runOnce(result)
    expect(result.current.error).toBe(FAILURE_MESSAGE)

    await runOnce(result)

    expect(result.current.error).toBe('')
  })
})