import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, isClockInRequired, isUnauthorized, setClockInRequiredHandler } from './api'
import {
  CLOCK_IN_REQUIRED_CASES,
  CLOCK_IN_REQUIRED_TEXT,
  END_DATE,
  FAILED_STATUS_CASES,
  INCOMPLETE_RANGE_CASES,
  OTHER_FAILURE_CASES,
  SHIFTS,
  START_DATE,
  UNAUTHORIZED_CASES,
  PASSWORD_CHANGE_ARGS,
  WRONG_PASSWORD_TEXT,
} from './test/fixtures/apiCases'

// Both schedule calls build their date range the same way
const RANGE_ENDPOINTS = [
  { name: 'getSchedules', path: '/api/schedule', call: api.getSchedules },
  { name: 'getMySchedule', path: '/api/my-schedule', call: api.getMySchedule },
]

// Ids for the marks calls, and one with characters that would change a route if they were not encoded
const HOLE_ID = 'hole-7'
const FEATURE_ID = 'feature-tee-box'
const TASK_ID = 'task-mowed'
const AWKWARD_ID = 'a/b?c d'
const ENCODED_AWKWARD_ID = 'a%2Fb%3Fc%20d'
const MARK_STATUSES = ['done', 'not_today']

const MARK = {
  feature_id: FEATURE_ID,
  task_id: TASK_ID,
  status: 'done',
  user_id: 'user-luke',
  user_name: 'Luke Skywalker',
  marked_at: '2026-11-17T12:48:00Z',
}
const HOLE_MARKS = { date: '2026-11-17', marks: [MARK] }

// The refusals each marks call can get, with the words the server uses for them
const HOLE_MARKS_FAILURES = [
  { label: 'an id that is not an id', status: 400, message: 'invalid hole id' },
  { label: 'a hole that does not exist', status: 404, message: 'hole not found' },
  { label: 'a server error', status: 500, message: 'could not fetch marks' },
]

const SET_MARK_FAILURES = [
  { label: 'a task someone already marked the other way', status: 409, message: 'already marked, undo it first' },
  { label: 'a person who may not check the task', status: 403, message: 'you are not allowed to check this task' },
  { label: 'a task that does not exist', status: 404, message: 'task not found' },
  { label: 'a status the server does not accept', status: 400, message: 'status must be done or not_today' },
]

const CLEAR_MARK_FAILURES = [
  { label: 'a person who may not check the task', status: 403, message: 'you are not allowed to check this task' },
  { label: 'a feature that does not exist', status: 404, message: 'feature not found' },
  { label: 'an id that is not an id', status: 400, message: 'invalid feature id' },
]

// Requests of different kinds, which must all be treated alike when the server refuses them
const REFUSED_REQUESTS = [
  { name: 'getCourse', call: () => api.getCourse() },
  { name: 'updateEquipmentStatus', call: () => api.updateEquipmentStatus('item-1', 'in_shop') },
  { name: 'getSchedules', call: () => api.getSchedules(START_DATE, END_DATE) },
  { name: 'deleteSchedules', call: () => api.deleteSchedules(['shift-1']) },
  { name: 'getHoleMarks', call: () => api.getHoleMarks(HOLE_ID) },
  { name: 'setTaskMark', call: () => api.setTaskMark(FEATURE_ID, TASK_ID, 'done') },
  { name: 'clearTaskMark', call: () => api.clearTaskMark(FEATURE_ID, TASK_ID) },
]

// Scenarios
let fetchMock

function respondWith(response) {
  fetchMock.mockResolvedValue(response)
}

function okResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) }
}

// What an undo gets back: success, with nothing to read. Reading it as JSON fails, as a real one does.
function noContentResponse() {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  }
}

function failedResponse(status, text) {
  return { ok: false, status, text: () => Promise.resolve(text) }
}

function respondWithClockInRequired() {
  respondWith(failedResponse(403, CLOCK_IN_REQUIRED_TEXT))
}

// The address of the first request sent, taken apart so the base address doesn't matter
function calledUrl() {
  return new URL(fetchMock.mock.calls[0][0])
}

// What a failed request throws, caught so a test can look at it
async function failureOf(call) {
  return call().catch((failure) => failure)
}

describe('api', () => {
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    respondWith(okResponse([]))
  })

  afterEach(() => {
    setClockInRequiredHandler(null)
    vi.unstubAllGlobals()
  })

  describe.each(RANGE_ENDPOINTS)('$name', ({ path, call }) => {
    it(`asks for ${path} with the range when both dates are given`, async () => {
      await call(START_DATE, END_DATE)

      expect(calledUrl().pathname).toBe(path)
      expect(calledUrl().search).toBe(`?start=${START_DATE}&end=${END_DATE}`)
    })

    it.each(INCOMPLETE_RANGE_CASES)('sends no range for $label', async ({ startDate, endDate }) => {
      await call(startDate, endDate)

      expect(calledUrl().pathname).toBe(path)
      expect(calledUrl().search).toBe('')
    })

    it('sends the session cookie along', async () => {
      await call(START_DATE, END_DATE)

      expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    })
  })

  describe('reading a response', () => {
    it('gives back the parsed body', async () => {
      respondWith(okResponse(SHIFTS))

      await expect(api.getMySchedule()).resolves.toEqual(SHIFTS)
    })

    it('gives back nothing when the server answers with no content', async () => {
      respondWith(noContentResponse())

      await expect(api.clearTaskMark(FEATURE_ID, TASK_ID)).resolves.toBeNull()
    })

    it('throws the server text as the error message when a request fails', async () => {
      respondWithClockInRequired()

      await expect(api.me()).rejects.toThrow('clock in required')
    })

    it('says which status failed when the server sent no text', async () => {
      respondWith(failedResponse(500, ''))

      await expect(api.me()).rejects.toThrow('Request failed: 500')
    })
  })

  describe('a failed request', () => {
    it.each(FAILED_STATUS_CASES)('carries the status $status', async ({ status }) => {
      respondWith(failedResponse(status, 'nope\n'))

      const failure = await failureOf(() => api.me())

      expect(failure).toBeInstanceOf(ApiError)
      expect(failure.status).toBe(status)
    })

    it('keeps the message free of the newline the server adds', async () => {
      respondWith(failedResponse(409, 'user is already clocked in\n'))

      const failure = await failureOf(() => api.clockIn())

      expect(failure.message).toBe('user is already clocked in')
    })

    it('falls back to the status when the server sent only whitespace', async () => {
      respondWith(failedResponse(500, '\n'))

      const failure = await failureOf(() => api.me())

      expect(failure.message).toBe('Request failed: 500')
      expect(failure.status).toBe(500)
    })
  })

  describe('isClockInRequired', () => {
    it.each(CLOCK_IN_REQUIRED_CASES)('says $expected for $label', ({ error, expected }) => {
      expect(isClockInRequired(error)).toBe(expected)
    })
  })

  describe('isUnauthorized', () => {
    it.each(UNAUTHORIZED_CASES)('says $expected for $label', ({ error, expected }) => {
      expect(isUnauthorized(error)).toBe(expected)
    })
  })

  describe('changePassword', () => {
    it('sends the two passwords to the change-password address as a POST', async () => {
      respondWith(okResponse({ message: 'password changed' }))

      await api.changePassword(PASSWORD_CHANGE_ARGS.current, PASSWORD_CHANGE_ARGS.replacement)

      const [, options] = fetchMock.mock.calls[0]
      expect(calledUrl().pathname).toBe('/api/change-password')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({
        current_password: PASSWORD_CHANGE_ARGS.current,
        new_password: PASSWORD_CHANGE_ARGS.replacement,
      })
    })

    it('sends nothing but the two passwords', async () => {
      respondWith(okResponse({ message: 'password changed' }))

      await api.changePassword(PASSWORD_CHANGE_ARGS.current, PASSWORD_CHANGE_ARGS.replacement)

      const sentKeys = Object.keys(JSON.parse(fetchMock.mock.calls[0][1].body)).sort()
      expect(sentKeys).toEqual(['current_password', 'new_password'])
    })

    it('sends the session cookie along', async () => {
      respondWith(okResponse({ message: 'password changed' }))

      await api.changePassword(PASSWORD_CHANGE_ARGS.current, PASSWORD_CHANGE_ARGS.replacement)

      expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    })

    it('throws an error carrying the status when the current password is wrong', async () => {
      respondWith(failedResponse(403, WRONG_PASSWORD_TEXT))

      const failure = await failureOf(() => api.changePassword('wrong', PASSWORD_CHANGE_ARGS.replacement))

      expect(failure).toBeInstanceOf(ApiError)
      expect(failure.status).toBe(403)
      expect(failure.message).toBe('current password is incorrect')
    })

    it('does not mistake a wrong password for a request to clock in', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWith(failedResponse(403, WRONG_PASSWORD_TEXT))

      await failureOf(() => api.changePassword('wrong', PASSWORD_CHANGE_ARGS.replacement))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('getHoleTasks', () => {
    const TASK_LIST_RESPONSE = { duties: [], tasks: [] }

    it('asks for the hole tasks with a GET and the session cookie', async () => {
      respondWith(okResponse(TASK_LIST_RESPONSE))

      await api.getHoleTasks()

      const [, options] = fetchMock.mock.calls[0]
      expect(calledUrl().pathname).toBe('/api/hole-tasks')
      expect(options.method).toBeUndefined()
      expect(options.credentials).toBe('include')
    })

    it('gives back the list the server sent', async () => {
      respondWith(okResponse(TASK_LIST_RESPONSE))

      await expect(api.getHoleTasks()).resolves.toEqual(TASK_LIST_RESPONSE)
    })

    it('announces clock in required, like the other work routes', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWithClockInRequired()

      await failureOf(() => api.getHoleTasks())

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getHoleMarks', () => {
    it("asks for the hole's marks with a GET and the session cookie", async () => {
      respondWith(okResponse(HOLE_MARKS))

      await api.getHoleMarks(HOLE_ID)

      const [, options] = fetchMock.mock.calls[0]
      expect(calledUrl().pathname).toBe(`/api/holes/${HOLE_ID}/marks`)
      expect(options.method).toBeUndefined()
      expect(options.credentials).toBe('include')
    })

    it('gives back what the server sent', async () => {
      respondWith(okResponse(HOLE_MARKS))

      await expect(api.getHoleMarks(HOLE_ID)).resolves.toEqual(HOLE_MARKS)
    })

    it('encodes the hole id so it cannot change the route', async () => {
      respondWith(okResponse(HOLE_MARKS))

      await api.getHoleMarks(AWKWARD_ID)

      expect(calledUrl().pathname).toBe(`/api/holes/${ENCODED_AWKWARD_ID}/marks`)
    })

    it.each(HOLE_MARKS_FAILURES)('fails with the status and the words of $label', async ({ status, message }) => {
      respondWith(failedResponse(status, `${message}\n`))

      const failure = await failureOf(() => api.getHoleMarks(HOLE_ID))

      expect(failure).toBeInstanceOf(ApiError)
      expect(failure.status).toBe(status)
      expect(failure.message).toBe(message)
    })
  })

  describe('setTaskMark', () => {
    it.each(MARK_STATUSES)('sends a PUT with the status %s', async (status) => {
      respondWith(okResponse({ ...MARK, status }))

      await api.setTaskMark(FEATURE_ID, TASK_ID, status)

      const [, options] = fetchMock.mock.calls[0]
      expect(calledUrl().pathname).toBe(`/api/marks/${FEATURE_ID}/${TASK_ID}`)
      expect(options.method).toBe('PUT')
      expect(options.credentials).toBe('include')
      expect(JSON.parse(options.body)).toEqual({ status })
    })

    it('gives back the mark the server saved', async () => {
      respondWith(okResponse(MARK))

      await expect(api.setTaskMark(FEATURE_ID, TASK_ID, 'done')).resolves.toEqual(MARK)
    })

    it('encodes both ids so they cannot change the route', async () => {
      respondWith(okResponse(MARK))

      await api.setTaskMark(AWKWARD_ID, AWKWARD_ID, 'done')

      expect(calledUrl().pathname).toBe(`/api/marks/${ENCODED_AWKWARD_ID}/${ENCODED_AWKWARD_ID}`)
    })

    it.each(SET_MARK_FAILURES)(
      'fails with the status and the words of $label, without calling it a clock-in problem',
      async ({ status, message }) => {
        const handler = vi.fn()
        setClockInRequiredHandler(handler)
        respondWith(failedResponse(status, `${message}\n`))

        const failure = await failureOf(() => api.setTaskMark(FEATURE_ID, TASK_ID, 'done'))

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.status).toBe(status)
        expect(failure.message).toBe(message)
        expect(handler).not.toHaveBeenCalled()
      }
    )
  })

  describe('clearTaskMark', () => {
    it('sends a DELETE with no body and the session cookie', async () => {
      respondWith(noContentResponse())

      await api.clearTaskMark(FEATURE_ID, TASK_ID)

      const [, options] = fetchMock.mock.calls[0]
      expect(calledUrl().pathname).toBe(`/api/marks/${FEATURE_ID}/${TASK_ID}`)
      expect(options.method).toBe('DELETE')
      expect(options.body).toBeUndefined()
      expect(options.credentials).toBe('include')
    })

    it('encodes both ids so they cannot change the route', async () => {
      respondWith(noContentResponse())

      await api.clearTaskMark(AWKWARD_ID, AWKWARD_ID)

      expect(calledUrl().pathname).toBe(`/api/marks/${ENCODED_AWKWARD_ID}/${ENCODED_AWKWARD_ID}`)
    })

    it.each(CLEAR_MARK_FAILURES)(
      'fails with the status and the words of $label, without calling it a clock-in problem',
      async ({ status, message }) => {
        const handler = vi.fn()
        setClockInRequiredHandler(handler)
        respondWith(failedResponse(status, `${message}\n`))

        const failure = await failureOf(() => api.clearTaskMark(FEATURE_ID, TASK_ID))

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.status).toBe(status)
        expect(failure.message).toBe(message)
        expect(handler).not.toHaveBeenCalled()
      }
    )
  })

  describe('when the server says clock in is required', () => {
    it('tells the handler once, and the caller still gets the error', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWithClockInRequired()

      await expect(api.getCourse()).rejects.toThrow('clock in required')

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('tells the handler on every such refusal', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWithClockInRequired()

      await failureOf(() => api.getCourse())
      await failureOf(() => api.getEquipment())

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it.each(REFUSED_REQUESTS)('tells the handler when $name is refused', async ({ call }) => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWithClockInRequired()

      await failureOf(call)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it.each(OTHER_FAILURE_CASES)('stays quiet for $label', async ({ status, text }) => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      respondWith(failedResponse(status, text))

      await failureOf(() => api.getCourse())

      expect(handler).not.toHaveBeenCalled()
    })

    it('stays quiet when requests succeed', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)

      await api.getCourse()

      expect(handler).not.toHaveBeenCalled()
    })

    it('tells only the newest handler after one is replaced', async () => {
      const replacedHandler = vi.fn()
      const newestHandler = vi.fn()
      setClockInRequiredHandler(replacedHandler)
      setClockInRequiredHandler(newestHandler)
      respondWithClockInRequired()

      await failureOf(() => api.getCourse())

      expect(replacedHandler).not.toHaveBeenCalled()
      expect(newestHandler).toHaveBeenCalledTimes(1)
    })

    it('tells nobody once the handler is removed', async () => {
      const handler = vi.fn()
      setClockInRequiredHandler(handler)
      setClockInRequiredHandler(null)
      respondWithClockInRequired()

      await expect(api.getCourse()).rejects.toThrow('clock in required')

      expect(handler).not.toHaveBeenCalled()
    })

    it('still gives the caller the real error when the handler throws', async () => {
      setClockInRequiredHandler(() => {
        throw new Error('the listener broke')
      })
      respondWithClockInRequired()

      await expect(api.getCourse()).rejects.toThrow('clock in required')
    })

    it('still gives the caller the real error when the handler rejects', async () => {
      setClockInRequiredHandler(() => Promise.reject(new Error('the listener broke')))
      respondWithClockInRequired()

      await expect(api.getCourse()).rejects.toThrow('clock in required')
    })
  })
})