const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
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