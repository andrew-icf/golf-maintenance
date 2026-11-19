import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '../../../api'
import { NOT_A_MARK_LIST_CASES, makeServerMark, serverItem } from '../../../test/fixtures/serverMarkCases'
import { createDeferred } from '../../../test/helpers'
import { useHoleMarks } from './useHoleMarks'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getHoleMarks: vi.fn(), setTaskMark: vi.fn(), clearTaskMark: vi.fn() },
}))

// The real ApiError and isClockInRequired stay, and only the calls to the server are replaced
vi.mock('../../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: apiMock,
}))

const HOLE_ID = 'hole-C7'
const CLUB_DATE = '2026-11-17'
const MOWED = serverItem('tee-box-mowed')
const CLEARED = serverItem('tee-box-cleared')
const YODAS_MARK = makeServerMark('tee-box-mowed')
const OTHER_MARK = makeServerMark('rough-mowed')

const SAVE_FAILED_TEXT = 'Couldn’t save. Try again.'
const NOT_ALLOWED_TEXT = 'You can’t check this task'
const STALE_LIST_TEXT = 'Saved, but the list couldn’t refresh. Reopen the hole to see the latest.'

const ACTION_CASES = [
  { name: 'check', mock: 'setTaskMark', args: [MOWED.featureId, MOWED.taskId, 'done'] },
  { name: 'skip', mock: 'setTaskMark', args: [MOWED.featureId, MOWED.taskId, 'not_today'] },
  { name: 'undo', mock: 'clearTaskMark', args: [MOWED.featureId, MOWED.taskId] },
]

const REFUSED_SAVE_CASES = [
  { label: 'a task the person may not check', failure: new ApiError('you are not allowed to check this task', 403), message: NOT_ALLOWED_TEXT },
  { label: 'a server error', failure: new ApiError('could not save the mark', 500), message: SAVE_FAILED_TEXT },
  { label: 'a dropped connection', failure: new TypeError('Failed to fetch'), message: SAVE_FAILED_TEXT },
  { label: 'a task that no longer exists', failure: new ApiError('task not found', 404), message: SAVE_FAILED_TEXT },
  { label: 'a status the server cannot read', failure: new ApiError('status must be done or not_today', 400), message: SAVE_FAILED_TEXT },
]

// Marks that do not tell who has the task, so the person is told "Someone"
const UNNAMED_OWNER_CASES = [
  { label: 'no mark for the task at all', marks: [OTHER_MARK] },
  { label: 'a mark with no name', marks: [makeServerMark('tee-box-mowed', { user_name: '' })] },
]

// Actions
function marksResponse(marks) {
  return { date: CLUB_DATE, marks }
}

async function renderLoadedHook(initialMarks = []) {
  apiMock.getHoleMarks.mockResolvedValue(marksResponse(initialMarks))
  const view = renderHook(() => useHoleMarks(HOLE_ID))
  await waitFor(() => expect(view.result.current.status).toBe('ready'))
  return view
}

// Taps a row and waits for everything it sets going to finish
async function tap(result, action, item) {
  await act(async () => {
    await result.current[action](item)
  })
}

describe('useHoleMarks', () => {
  beforeEach(() => {
    apiMock.getHoleMarks.mockReset()
    apiMock.setTaskMark.mockReset()
    apiMock.clearTaskMark.mockReset()
  })

  describe('loading', () => {
    it('starts loading and asks for the hole’s marks once', async () => {
      const marks = createDeferred()
      apiMock.getHoleMarks.mockReturnValue(marks.promise)

      const { result } = renderHook(() => useHoleMarks(HOLE_ID))

      expect(result.current.status).toBe('loading')
      expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(1)
      expect(apiMock.getHoleMarks).toHaveBeenCalledWith(HOLE_ID)
      await act(async () => {
        marks.resolve(marksResponse([]))
      })
    })

    it('is ready with the club’s date and the marks once they arrive', async () => {
      const { result } = await renderLoadedHook([YODAS_MARK])

      expect(result.current.date).toBe(CLUB_DATE)
      expect(result.current.serverMarks).toEqual([YODAS_MARK])
      expect(result.current.error).toBe('')
    })

    it('is ready with no marks when there are none yet', async () => {
      const { result } = await renderLoadedHook([])

      expect(result.current.serverMarks).toEqual([])
    })

    it.each(NOT_A_MARK_LIST_CASES)('treats marks that are $label as no marks', async ({ serverMarks }) => {
      apiMock.getHoleMarks.mockResolvedValue({ date: CLUB_DATE, marks: serverMarks })

      const { result } = renderHook(() => useHoleMarks(HOLE_ID))
      await waitFor(() => expect(result.current.status).toBe('ready'))

      expect(result.current.serverMarks).toEqual([])
    })

    it('has no date when the server sends none', async () => {
      apiMock.getHoleMarks.mockResolvedValue({ marks: [] })

      const { result } = renderHook(() => useHoleMarks(HOLE_ID))
      await waitFor(() => expect(result.current.status).toBe('ready'))

      expect(result.current.date).toBeNull()
    })

    it('shows the server’s words when the first load fails', async () => {
      apiMock.getHoleMarks.mockRejectedValue(new ApiError('hole not found', 404))

      const { result } = renderHook(() => useHoleMarks(HOLE_ID))
      await waitFor(() => expect(result.current.status).toBe('error'))

      expect(result.current.error).toBe('hole not found')
      expect(result.current.serverMarks).toEqual([])
    })

    it('says so plainly when the failure has no words', async () => {
      apiMock.getHoleMarks.mockRejectedValue('nope')

      const { result } = renderHook(() => useHoleMarks(HOLE_ID))
      await waitFor(() => expect(result.current.status).toBe('error'))

      expect(result.current.error).toBe('Could not load the marks')
    })

    it('tries again on retry, showing loading first', async () => {
      apiMock.getHoleMarks.mockRejectedValueOnce(new ApiError('could not fetch marks', 500))
      const { result } = renderHook(() => useHoleMarks(HOLE_ID))
      await waitFor(() => expect(result.current.status).toBe('error'))
      const retried = createDeferred()
      apiMock.getHoleMarks.mockReturnValue(retried.promise)

      act(() => {
        result.current.retry()
      })

      expect(result.current.status).toBe('loading')
      await act(async () => {
        retried.resolve(marksResponse([YODAS_MARK]))
      })
      expect(result.current.status).toBe('ready')
      expect(result.current.serverMarks).toEqual([YODAS_MARK])
    })

    it('asks for the new hole’s marks when the hole changes, and ignores a late answer for the old one', async () => {
      const late = createDeferred()
      apiMock.getHoleMarks
        .mockReturnValueOnce(late.promise)
        .mockResolvedValueOnce(marksResponse([OTHER_MARK]))
      const { result, rerender } = renderHook(({ holeId }) => useHoleMarks(holeId), {
        initialProps: { holeId: 'hole-A' },
      })

      rerender({ holeId: 'hole-B' })
      await waitFor(() => expect(result.current.status).toBe('ready'))
      await act(async () => {
        late.resolve(marksResponse([YODAS_MARK]))
      })

      expect(apiMock.getHoleMarks.mock.calls.map(([holeId]) => holeId)).toEqual(['hole-A', 'hole-B'])
      expect(result.current.serverMarks).toEqual([OTHER_MARK])
    })
  })

  describe('saving a tap', () => {
    describe.each(ACTION_CASES)('$name', ({ name, mock, args }) => {
      it('sends the row’s feature and task to the server, then reloads the marks', async () => {
        const { result } = await renderLoadedHook()
        apiMock[mock].mockResolvedValue(YODAS_MARK)

        await tap(result, name, MOWED)

        expect(apiMock[mock]).toHaveBeenCalledWith(...args)
        expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(2)
      })
    })

    it('keeps the row saving until the server has answered and the marks have reloaded', async () => {
      const { result } = await renderLoadedHook()
      const save = createDeferred()
      const reload = createDeferred()
      apiMock.setTaskMark.mockReturnValue(save.promise)
      apiMock.getHoleMarks.mockReturnValue(reload.promise)

      act(() => {
        result.current.check(MOWED)
      })
      expect([...result.current.pendingIds]).toEqual([MOWED.id])

      await act(async () => {
        save.resolve(YODAS_MARK)
      })
      expect([...result.current.pendingIds]).toEqual([MOWED.id])

      await act(async () => {
        reload.resolve(marksResponse([YODAS_MARK]))
      })
      expect(result.current.pendingIds.size).toBe(0)
    })

    it('shows the marks the server sends after saving', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockResolvedValue(YODAS_MARK)
      apiMock.getHoleMarks.mockResolvedValue(marksResponse([YODAS_MARK]))

      await tap(result, 'check', MOWED)

      expect(result.current.serverMarks).toEqual([YODAS_MARK])
      expect(result.current.notice).toBeNull()
    })

    it('no longer shows a mark after it is undone', async () => {
      const { result } = await renderLoadedHook([YODAS_MARK])
      apiMock.clearTaskMark.mockResolvedValue(null)
      apiMock.getHoleMarks.mockResolvedValue(marksResponse([]))

      await tap(result, 'undo', MOWED)

      expect(result.current.serverMarks).toEqual([])
    })

    it('ignores a second tap on a row that is still saving', async () => {
      const { result } = await renderLoadedHook()
      const save = createDeferred()
      apiMock.setTaskMark.mockReturnValue(save.promise)

      act(() => {
        result.current.check(MOWED)
      })
      act(() => {
        result.current.check(MOWED)
      })

      expect(apiMock.setTaskMark).toHaveBeenCalledTimes(1)
      await act(async () => {
        save.resolve(YODAS_MARK)
      })
    })

    it('lets other rows be tapped while one is saving', async () => {
      const { result } = await renderLoadedHook()
      const save = createDeferred()
      apiMock.setTaskMark.mockReturnValue(save.promise)

      act(() => {
        result.current.check(MOWED)
      })
      act(() => {
        result.current.check(CLEARED)
      })

      expect(apiMock.setTaskMark).toHaveBeenCalledTimes(2)
      expect([...result.current.pendingIds].sort()).toEqual([CLEARED.id, MOWED.id].sort())
      await act(async () => {
        save.resolve(YODAS_MARK)
      })
      expect(result.current.pendingIds.size).toBe(0)
    })

    it('lets the row be tapped again once it has finished saving', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockResolvedValue(YODAS_MARK)

      await tap(result, 'check', MOWED)
      await tap(result, 'check', MOWED)

      expect(apiMock.setTaskMark).toHaveBeenCalledTimes(2)
    })

    it('shows the newest answer when reloads finish out of order', async () => {
      const { result } = await renderLoadedHook()
      const first = createDeferred()
      const second = createDeferred()
      apiMock.setTaskMark.mockResolvedValue(YODAS_MARK)
      apiMock.getHoleMarks.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      act(() => {
        result.current.check(MOWED)
      })
      act(() => {
        result.current.check(CLEARED)
      })
      await act(async () => {})
      await act(async () => {
        second.resolve(marksResponse([OTHER_MARK]))
      })
      await act(async () => {
        first.resolve(marksResponse([]))
      })

      expect(result.current.serverMarks).toEqual([OTHER_MARK])
    })
  })

  describe('when something goes wrong', () => {
    it('tells the person who already marked it, when someone got there first', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('already marked, undo it first', 409))
      apiMock.getHoleMarks.mockResolvedValue(marksResponse([YODAS_MARK]))

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toEqual({ itemId: MOWED.id, message: 'Yoda already marked this' })
      expect(result.current.serverMarks).toEqual([YODAS_MARK])
    })

    it.each(UNNAMED_OWNER_CASES)('says "Someone" when the reload has $label', async ({ marks }) => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('already marked, undo it first', 409))
      apiMock.getHoleMarks.mockResolvedValue(marksResponse(marks))

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toEqual({ itemId: MOWED.id, message: 'Someone already marked this' })
    })

    it.each(REFUSED_SAVE_CASES)('tells the person about $label, and reloads the marks', async ({ failure, message }) => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(failure)

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toEqual({ itemId: MOWED.id, message })
      expect(result.current.pendingIds.size).toBe(0)
      expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(2)
    })

    it('says nothing when the server wants the person to clock in, since that screen appears', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('clock in required', 403))

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toBeNull()
      expect(result.current.pendingIds.size).toBe(0)
    })

    it('keeps the marks on screen and says so when a save worked but the reload failed', async () => {
      const { result } = await renderLoadedHook([OTHER_MARK])
      apiMock.setTaskMark.mockResolvedValue(YODAS_MARK)
      apiMock.getHoleMarks.mockRejectedValue(new TypeError('Failed to fetch'))

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toEqual({ itemId: MOWED.id, message: STALE_LIST_TEXT })
      expect(result.current.status).toBe('ready')
      expect(result.current.serverMarks).toEqual([OTHER_MARK])
    })

    it('tells the person the save failed when the reload failed too', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('could not save the mark', 500))
      apiMock.getHoleMarks.mockRejectedValue(new TypeError('Failed to fetch'))

      await tap(result, 'check', MOWED)

      expect(result.current.notice).toEqual({ itemId: MOWED.id, message: SAVE_FAILED_TEXT })
    })

    it('clears the earlier message when the person taps again', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('could not save the mark', 500))
      await tap(result, 'check', MOWED)
      expect(result.current.notice).not.toBeNull()
      const save = createDeferred()
      apiMock.setTaskMark.mockReturnValue(save.promise)

      act(() => {
        result.current.check(CLEARED)
      })

      expect(result.current.notice).toBeNull()
      await act(async () => {
        save.resolve(YODAS_MARK)
      })
    })

    it('clears the message when it is dismissed', async () => {
      const { result } = await renderLoadedHook()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('could not save the mark', 500))
      await tap(result, 'check', MOWED)

      act(() => {
        result.current.dismissNotice()
      })

      expect(result.current.notice).toBeNull()
    })
  })
})