import { ApiError } from '../../api'

const FALLBACK = { field: null, message: 'Could not change your password. Try again.' }
const NETWORK = { field: null, message: 'Could not reach the server. Check the connection and try again.' }

// What the person is told, and which field it belongs to, for each way the change can fail
export const FAILURE_CASES = [
  {
    label: 'a wrong current password',
    failure: new ApiError('current password is incorrect', 403),
    expected: { field: 'currentPassword', message: 'Your current password is incorrect.' },
  },
  {
    label: 'a wrong current password with the newline the server adds',
    failure: new ApiError('current password is incorrect\n', 403),
    expected: { field: 'currentPassword', message: 'Your current password is incorrect.' },
  },
  {
    label: 'a new password the server finds too short',
    failure: new ApiError('new password must be at least 8 characters', 400),
    expected: { field: 'newPassword', message: 'New password must be at least 8 characters.' },
  },
  {
    label: 'a new password the server finds to be only spaces',
    failure: new ApiError('new password cannot be only spaces', 400),
    expected: { field: 'newPassword', message: 'New password cannot be only spaces.' },
  },
  {
    label: 'a new password the server finds too long',
    failure: new ApiError(
      'new password is too long: at most 72 bytes (some characters count as more than one)',
      400
    ),
    expected: {
      field: 'newPassword',
      message: 'New password is too long: at most 72 bytes (some characters count as more than one).',
    },
  },
  {
    label: 'a new password the server finds the same as the current one',
    failure: new ApiError('new password must be different from the current password', 400),
    expected: { field: 'newPassword', message: 'New password must be different from the current password.' },
  },
  {
    label: 'a 400 about missing fields',
    failure: new ApiError('current_password and new_password are required', 400),
    expected: FALLBACK,
  },
  {
    label: 'a 403 about permissions',
    failure: new ApiError('forbidden: insufficient permissions', 403),
    expected: FALLBACK,
  },
  {
    label: 'a 403 about clocking in',
    failure: new ApiError('clock in required', 403),
    expected: FALLBACK,
  },
  {
    label: 'a session that has ended',
    failure: new ApiError('invalid or expired session', 401),
    expected: { field: null, message: 'Your session has ended. Log in again.' },
  },
  {
    label: 'a server error',
    failure: new ApiError('internal server error', 500),
    expected: FALLBACK,
  },
  {
    label: 'a dropped connection in Chrome',
    failure: new TypeError('Failed to fetch'),
    expected: NETWORK,
  },
  {
    label: 'a dropped connection in Firefox',
    failure: new TypeError('NetworkError when attempting to fetch resource.'),
    expected: NETWORK,
  },
  {
    label: 'a dropped connection in Safari',
    failure: new TypeError('Load failed'),
    expected: NETWORK,
  },
  {
    label: 'a mistake in the code, which is not a dropped connection',
    failure: new TypeError('undefined is not a function'),
    expected: FALLBACK,
  },
  { label: 'a plain error', failure: new Error('something broke'), expected: FALLBACK },
  { label: 'nothing at all', failure: undefined, expected: FALLBACK },
  { label: 'null', failure: null, expected: FALLBACK },
]

// The words the form shows
export const SUCCESS_TEXT =
  'Your password was changed. Any other devices you were signed in on have been signed out.'
export const NETWORK_MESSAGE = NETWORK.message
export const WRONG_CURRENT_MESSAGE = 'Your current password is incorrect.'
export const MISSING_CURRENT_MESSAGE = 'Enter your current password.'
export const TOO_SHORT_MESSAGE = 'New password must be at least 8 characters.'
export const MINIMUM_LENGTH_HINT = 'At least 8 characters.'