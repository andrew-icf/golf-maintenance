import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

// Test data
const START_DATE = '2026-10-25'
const END_DATE = '2026-10-31'
const SHIFTS = [{ id: 'shift-1', user_id: 'user-1', shift_date: START_DATE }]

// As the server sends it, with the newline Go's http.Error adds
const CLOCK_IN_REQUIRED_TEXT = 'clock in required\n'

// Both schedule calls build their date range the same way
const RANGE_ENDPOINTS = [
  { name: 'getSchedules', path: '/api/schedule', call: api.getSchedules },
  { name: 'getMySchedule', path: '/api/my-schedule', call: api.getMySchedule },
]

// The server wants both dates or neither, so the client sends a range only when it has both
const INCOMPLETE_RANGE_CASES = [
  { label: 'only a start date', startDate: START_DATE, endDate: undefined },
  { label: 'only an end date', startDate: undefined, endDate: END_DATE },
  { label: 'empty strings', startDate: '', endDate: '' },
  { label: 'no dates', startDate: undefined, endDate: undefined },
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

// The address of the first request sent, taken apart so the base address doesn't matter
function calledUrl() {
  return new URL(fetchMock.mock.calls[0][0])
}

describe('api', () => {
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    respondWith(okResponse([]))
  })

  afterEach(() => {
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
      respondWith(failedResponse(403, CLOCK_IN_REQUIRED_TEXT))

      await expect(api.me()).rejects.toThrow('clock in required')
    })

    it('says which status failed when the server sent no text', async () => {
      respondWith(failedResponse(500, ''))

      await expect(api.me()).rejects.toThrow('Request failed: 500')
    })
  })
})