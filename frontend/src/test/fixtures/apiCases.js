import { ApiError } from '../../api'

export const START_DATE = '2026-10-25'
export const END_DATE = '2026-10-31'
export const SHIFTS = [{ id: 'shift-1', user_id: 'user-1', shift_date: START_DATE }]

// As the server sends it, with the newline Go's http.Error adds
export const CLOCK_IN_REQUIRED_TEXT = 'clock in required\n'

// The server wants both dates or neither, so the client sends a range only when it has both
export const INCOMPLETE_RANGE_CASES = [
  { label: 'only a start date', startDate: START_DATE, endDate: undefined },
  { label: 'only an end date', startDate: undefined, endDate: END_DATE },
  { label: 'empty strings', startDate: '', endDate: '' },
  { label: 'no dates', startDate: undefined, endDate: undefined },
]

// Statuses a failed request can carry
export const FAILED_STATUS_CASES = [
  { status: 400 },
  { status: 401 },
  { status: 403 },
  { status: 404 },
  { status: 409 },
  { status: 500 },
]

// Failures that must not be mistaken for being asked to clock in
export const OTHER_FAILURE_CASES = [
  { label: 'a 403 about permissions', status: 403, text: 'forbidden: insufficient permissions\n' },
  { label: 'a 401 that says not authenticated', status: 401, text: 'not authenticated\n' },
  { label: 'a 409 conflict', status: 409, text: 'user is already clocked in\n' },
  { label: 'a 500', status: 500, text: 'internal server error\n' },
  { label: 'a 401 that happens to use the clock-in wording', status: 401, text: CLOCK_IN_REQUIRED_TEXT },
]

// What counts as the server asking someone to clock in
export const CLOCK_IN_REQUIRED_CASES = [
  { label: 'a 403 with the clock-in message', error: new ApiError('clock in required', 403), expected: true },
  { label: 'a 403 whose message still has the newline', error: new ApiError('clock in required\n', 403), expected: true },
  { label: 'a 403 about permissions', error: new ApiError('forbidden: insufficient permissions', 403), expected: false },
  { label: 'the same message with a 401', error: new ApiError('clock in required', 401), expected: false },
  { label: 'the same message with a 500', error: new ApiError('clock in required', 500), expected: false },
  { label: 'the message in another capitalization', error: new ApiError('Clock in required', 403), expected: false },
  { label: 'a plain error with the same message', error: new Error('clock in required'), expected: false },
  { label: 'a plain object that looks like one', error: { status: 403, message: 'clock in required' }, expected: false },
  { label: 'text', error: 'clock in required', expected: false },
  { label: 'null', error: null, expected: false },
  { label: 'undefined', error: undefined, expected: false },
]

// What counts as the server saying there is no valid session
export const UNAUTHORIZED_CASES = [
  { label: 'a 401 saying not authenticated', error: new ApiError('not authenticated', 401), expected: true },
  { label: 'a 401 about an expired session', error: new ApiError('invalid or expired session', 401), expected: true },
  { label: 'a 401 with only the fallback message', error: new ApiError('Request failed: 401', 401), expected: true },
  { label: 'a 403', error: new ApiError('clock in required', 403), expected: false },
  { label: 'a 500', error: new ApiError('internal server error', 500), expected: false },
  { label: 'a plain error with the same message', error: new Error('not authenticated'), expected: false },
  { label: 'a plain object that looks like one', error: { status: 401, message: 'not authenticated' }, expected: false },
  { label: 'text', error: 'not authenticated', expected: false },
  { label: 'null', error: null, expected: false },
  { label: 'undefined', error: undefined, expected: false },
]