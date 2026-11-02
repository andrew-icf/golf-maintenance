import { ApiError } from '../../api'

// What the server says when the current password is wrong, which must match the backend
const WRONG_CURRENT_PASSWORD_SERVER_MESSAGE = 'current password is incorrect'
const FALLBACK_MESSAGE = 'Could not change your password. Try again.'
// How browsers word a failed connection: Chrome, Firefox, and Safari respectively
const NETWORK_FAILURE_PATTERN = /failed to fetch|networkerror|load failed/i

function sentenceFrom(serverMessage) {
  const capitalized = serverMessage.charAt(0).toUpperCase() + serverMessage.slice(1)
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

export function describePasswordChangeFailure(failure) {
  if (failure instanceof ApiError) {
    const serverMessage = failure.message.trim()

    if (failure.status === 403 && serverMessage === WRONG_CURRENT_PASSWORD_SERVER_MESSAGE) {
      return { field: 'currentPassword', message: 'Your current password is incorrect.' }
    }
    if (failure.status === 400 && serverMessage.startsWith('new password')) {
      return { field: 'newPassword', message: sentenceFrom(serverMessage) }
    }
    if (failure.status === 401) {
      return { field: null, message: 'Your session has ended. Log in again.' }
    }
  }

  if (failure instanceof TypeError && NETWORK_FAILURE_PATTERN.test(failure.message)) {
    return { field: null, message: 'Could not reach the server. Check the connection and try again.' }
  }

  return { field: null, message: FALLBACK_MESSAGE }
}