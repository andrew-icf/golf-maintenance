const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// What the server says when someone who is not on the clock asks for work. It must match
// auth.ClockInRequiredMessage in the backend.
const CLOCK_IN_REQUIRED_MESSAGE = 'clock in required'

// A failed request, carrying the status code as well as the server's message
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// True only for the server's refusal of someone who is not on the clock, and nothing else
export function isClockInRequired(error) {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.message.trim() === CLOCK_IN_REQUIRED_MESSAGE
  )
}

// True only for a refusal because there is no valid session (HTTP 401)
export function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401
}

let clockInRequiredHandler = null

// Registers what to do when the server turns a request away because the person is not on the
// clock, which the app uses to bring up the clock-in screen. One handler at a time, and null
// removes it.
export function setClockInRequiredHandler(handler) {
  clockInRequiredHandler = handler
}

function notifyClockInRequired() {
  if (!clockInRequiredHandler) {
    return
  }

  try {
    Promise.resolve(clockInRequiredHandler()).catch(() => {})
  } catch {
    // A failing listener must never hide the real error from the caller
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = (await response.text()).trim()
    const error = new ApiError(text || `Request failed: ${response.status}`, response.status)

    if (isClockInRequired(error)) {
      notifyClockInRequired()
    }
    throw error
  }

  return response.json()
}

// "?start=2026-10-04&end=2026-10-10", or nothing unless both dates are given
function dateRangeQuery(startDate, endDate) {
  return startDate && endDate ? `?start=${startDate}&end=${endDate}` : ''
}

export const api = {
  login: (email, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => request('/logout', { method: 'POST' }),

  me: () => request('/me'),

  clockIn: () => request('/clock-in', { method: 'POST' }),

  clockOut: () => request('/clock-out', { method: 'POST' }),

  getCourse: () => request('/api/course'),

  getEquipment: () => request('/api/equipment'),

  updateEquipmentStatus: (id, status) =>
    request(`/api/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getUsers: () => request('/api/users'),

  getSchedules: (startDate, endDate) =>
    request(`/api/schedule${dateRangeQuery(startDate, endDate)}`),

  // Only the logged-in person's own shifts. Unlike getSchedules, it works before clock-in.
  getMySchedule: (startDate, endDate) =>
    request(`/api/my-schedule${dateRangeQuery(startDate, endDate)}`),

  getRoster: () => request('/api/roster'),

  createSchedule: (shift) =>
    request('/api/schedule', {
      method: 'POST',
      body: JSON.stringify(shift),
    }),

  repeatSchedule: (pattern) =>
    request('/api/schedule/repeat', {
      method: 'POST',
      body: JSON.stringify(pattern),
    }),

  updateSchedule: (shiftId, shift) =>
    request(`/api/schedule/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(shift),
    }),

  deleteSchedules: (shiftIds) =>
    request('/api/schedule', {
      method: 'DELETE',
      body: JSON.stringify({ ids: shiftIds }),
    }),
}