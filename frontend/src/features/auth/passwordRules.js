// The rules for a new password, matching the server's (auth.ValidateNewPassword), so the form
// can say what is wrong before it asks. The server checks everything again and has the last
// word, so these only save a trip.
export const MIN_PASSWORD_LENGTH = 8
// bcrypt reads only the first 72 bytes of a password, so the server turns longer ones away
export const MAX_PASSWORD_BYTES = 72

export const PASSWORD_PROBLEMS = {
  TOO_SHORT: 'too_short',
  ONLY_SPACES: 'only_spaces',
  TOO_LONG: 'too_long',
  SAME_AS_CURRENT: 'same_as_current',
}

const PROBLEM_MESSAGES = {
  [PASSWORD_PROBLEMS.TOO_SHORT]: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  [PASSWORD_PROBLEMS.ONLY_SPACES]: 'New password cannot be only spaces.',
  [PASSWORD_PROBLEMS.TOO_LONG]: `New password is too long. The limit is ${MAX_PASSWORD_BYTES} bytes, and some characters count as more than one.`,
  [PASSWORD_PROBLEMS.SAME_AS_CURRENT]: 'New password must be different from the current one.',
}
const MISSING_CURRENT_MESSAGE = 'Enter your current password.'
const MISMATCH_MESSAGE = 'The new passwords do not match.'

// Anything that isn't text counts as nothing typed
function asText(value) {
  return typeof value === 'string' ? value : ''
}

// Counts characters the way a person does: an emoji is one character, though a JavaScript
// string's length says two. The server counts characters the same way.
function countCharacters(text) {
  return Array.from(text).length
}

function countBytes(text) {
  return new TextEncoder().encode(text).length
}

// What is wrong with a password someone wants to switch to, as one of PASSWORD_PROBLEMS, or
// null when it is fine. The rules are checked in the same order as the server checks them.
export function findPasswordProblem(newPassword, currentPassword) {
  const replacement = asText(newPassword)

  if (countCharacters(replacement) < MIN_PASSWORD_LENGTH) {
    return PASSWORD_PROBLEMS.TOO_SHORT
  }
  if (replacement.trim() === '') {
    return PASSWORD_PROBLEMS.ONLY_SPACES
  }
  if (countBytes(replacement) > MAX_PASSWORD_BYTES) {
    return PASSWORD_PROBLEMS.TOO_LONG
  }
  if (replacement === asText(currentPassword)) {
    return PASSWORD_PROBLEMS.SAME_AS_CURRENT
  }
  return null
}

// Checks the change-password form: a message for each field that has a problem, and an empty
// string for each that doesn't. The confirmation is compared exactly, spaces and capitals
// included, because it exists to catch a typo.
export function validatePasswordForm({ currentPassword = '', newPassword = '', confirmPassword = '' } = {}) {
  const problem = findPasswordProblem(newPassword, currentPassword)

  const errors = {
    currentPassword: asText(currentPassword) === '' ? MISSING_CURRENT_MESSAGE : '',
    newPassword: problem ? PROBLEM_MESSAGES[problem] : '',
    confirmPassword: asText(confirmPassword) === asText(newPassword) ? '' : MISMATCH_MESSAGE,
  }

  return { errors, isValid: Object.values(errors).every((message) => message === '') }
}