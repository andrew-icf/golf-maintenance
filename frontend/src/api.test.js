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

// Requests of different kinds, which must all be treated alike when the server refuses them
const REFUSED_REQUESTS = [
  { name: 'getCourse', call: () => api.getCourse() },
  { name: 'updateEquipmentStatus', call: () => api.updateEquipmentStatus('item-1', 'in_shop') },
  { name: 'getSchedules', call: () => api.getSchedules(START_DATE, END_DATE) },
  { name: 'deleteSchedules', call: () => api.deleteSchedules(['shift-1']) },
]

// Scenarios
let fetchMock

function respondWith(response) {
  fetchMock.mockResolvedValue(response)
}

function okResponse(body) {
  return { ok: true, json: () => Promise.resolve(body) }
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