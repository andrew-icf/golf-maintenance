import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, isClockInRequired } from '../../../api'
import { MARK_STATUS } from './checklistMarks'

const LOADING = { status: 'loading', date: null, marks: [], error: '' }

function describeFailure(error) {
  return error instanceof Error && error.message ? error.message : 'Could not load the marks'
}

// What to tell the person about the row they just tapped, or nothing
function buildNotice(item, failure, reloaded) {
  let message = ''

  if (failure) {
    // The clock-in screen takes over, so there is nothing to say
    if (isClockInRequired(failure)) {
      return null
    }
    if (failure instanceof ApiError && failure.status === 409) {
      const owner = reloaded.marks.find(
        (mark) => mark?.feature_id === item.featureId && mark?.task_id === item.taskId
      )
      message = `${owner?.user_name || 'Someone'} already marked this`
    } else if (failure instanceof ApiError && failure.status === 403) {
      message = 'You can’t check this task'
    } else {
      message = 'Couldn’t save. Try again.'
    }
  } else if (!reloaded.ok) {
    message = 'Saved, but the list couldn’t refresh. Reopen the hole to see the latest.'
  }

  return message ? { itemId: item.id, message } : null
}

// Today's marks for one hole, kept in step with the server. Every save is followed by a reload, and
// the server's answer is what the page shows. The hole page keys this by hole, so a new hole starts
// from scratch.
export function useHoleMarks(holeId) {
  const [load, setLoad] = useState(LOADING)
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [notice, setNotice] = useState(null)
  const pendingRef = useRef(new Set())
  const latestRequest = useRef(0)

  // Only the newest request is shown, so answers that arrive out of order cannot show old data
  const fetchMarks = useCallback(async () => {
    latestRequest.current += 1
    const thisRequest = latestRequest.current

    try {
      const result = await api.getHoleMarks(holeId)
      const marks = Array.isArray(result?.marks) ? result.marks : []
      if (thisRequest === latestRequest.current) {
        const date = typeof result?.date === 'string' ? result.date : null
        setLoad({ status: 'ready', date, marks, error: '' })
      }
      return { ok: true, marks }
    } catch (error) {
      if (thisRequest === latestRequest.current) {
        // Marks already on screen stay there when a later reload fails
        setLoad((current) =>
          current.status === 'ready' ? current : { ...LOADING, status: 'error', error: describeFailure(error) }
        )
      }
      return { ok: false, marks: [] }
    }
  }, [holeId])

  useEffect(() => {
    fetchMarks()
  }, [fetchMarks])

  const run = useCallback(
    async (item, send) => {
      if (!item || pendingRef.current.has(item.id)) {
        return
      }

      pendingRef.current.add(item.id)
      setPendingIds(new Set(pendingRef.current))
      setNotice(null)

      let failure = null
      try {
        await send()
      } catch (error) {
        failure = error
      }
      const reloaded = await fetchMarks()

      pendingRef.current.delete(item.id)
      setPendingIds(new Set(pendingRef.current))
      setNotice(buildNotice(item, failure, reloaded))
    },
    [fetchMarks]
  )

  const check = useCallback(
    (item) => run(item, () => api.setTaskMark(item.featureId, item.taskId, MARK_STATUS.DONE)),
    [run]
  )
  const skip = useCallback(
    (item) => run(item, () => api.setTaskMark(item.featureId, item.taskId, MARK_STATUS.NOT_TODAY)),
    [run]
  )
  const undo = useCallback((item) => run(item, () => api.clearTaskMark(item.featureId, item.taskId)), [run])

  const retry = useCallback(() => {
    setLoad(LOADING)
    fetchMarks()
  }, [fetchMarks])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return {
    status: load.status,
    date: load.date,
    serverMarks: load.marks,
    error: load.error,
    pendingIds,
    notice,
    check,
    skip,
    undo,
    retry,
    dismissNotice,
  }
}