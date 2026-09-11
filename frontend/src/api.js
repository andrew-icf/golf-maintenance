const BASE_URL = 'http://localhost:8080'

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

export const api = {
  login: (email, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => request('/logout', { method: 'POST' }),

  me: () => request('/me'),

  clockIn: () => request('/clock-in', { method: 'POST' }),

  clockOut: () => request('/clock-out', { method: 'POST' }),
}