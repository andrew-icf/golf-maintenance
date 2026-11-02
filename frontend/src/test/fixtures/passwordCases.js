// Written as escapes, so the characters are exactly what they say whatever the editor does:
// one character that takes two, three, and four bytes
const TWO_BYTE_CHARACTER = '\u00e9'
const THREE_BYTE_CHARACTER = '\u65e5'
const FOUR_BYTE_CHARACTER = '\u{1F600}'

export const CURRENT_PASSWORD = 'password123'
export const NEW_PASSWORD = 'tatooine-sunset-42'

export const EXPECTED_MIN_LENGTH = 8
export const EXPECTED_MAX_BYTES = 72

// The same cases the server's own tests use, plus emoji, which count as one character each
export const ACCEPTED_PASSWORD_CASES = [
  { label: 'eight plain characters', newPassword: 'abcd1234' },
  { label: 'eight characters that take two bytes each', newPassword: TWO_BYTE_CHARACTER.repeat(8) },
  { label: 'exactly 72 bytes', newPassword: 'a'.repeat(72) },
  { label: '72 bytes made of two-byte characters', newPassword: TWO_BYTE_CHARACTER.repeat(36) },
  { label: 'a passphrase with spaces', newPassword: 'correct horse battery' },
  { label: 'spaces around real characters', newPassword: ' abcdefgh ' },
  { label: 'the current password in another case', newPassword: 'Password123' },
  { label: 'eight emoji, which JavaScript counts as sixteen', newPassword: FOUR_BYTE_CHARACTER.repeat(8) },
  { label: 'eighteen emoji, exactly 72 bytes', newPassword: FOUR_BYTE_CHARACTER.repeat(18) },
]

export const REFUSED_PASSWORD_CASES = [
  { label: 'nothing', newPassword: '', expected: 'too_short' },
  { label: 'seven plain characters', newPassword: 'abc1234', expected: 'too_short' },
  { label: 'seven characters that take two bytes each', newPassword: TWO_BYTE_CHARACTER.repeat(7), expected: 'too_short' },
  { label: 'seven emoji, which JavaScript counts as fourteen', newPassword: FOUR_BYTE_CHARACTER.repeat(7), expected: 'too_short' },
  { label: '73 bytes', newPassword: 'a'.repeat(73), expected: 'too_long' },
  { label: '37 two-byte characters, which is 74 bytes', newPassword: TWO_BYTE_CHARACTER.repeat(37), expected: 'too_long' },
  { label: '25 three-byte characters, which is 75 bytes', newPassword: THREE_BYTE_CHARACTER.repeat(25), expected: 'too_long' },
  { label: 'nineteen emoji, which is 76 bytes', newPassword: FOUR_BYTE_CHARACTER.repeat(19), expected: 'too_long' },
  { label: 'ten spaces', newPassword: ' '.repeat(10), expected: 'only_spaces' },
  { label: 'eight tabs', newPassword: '\t'.repeat(8), expected: 'only_spaces' },
  { label: 'ten non-breaking spaces', newPassword: '\u00a0'.repeat(10), expected: 'only_spaces' },
  { label: 'the current password', newPassword: CURRENT_PASSWORD, expected: 'same_as_current' },
]

// Anything that is not text counts as nothing typed, so it is too short
export const NOT_TEXT_CASES = [
  { label: 'null', newPassword: null },
  { label: 'undefined', newPassword: undefined },
  { label: 'a number', newPassword: 12345678 },
]

// The sentences the form shows
const MISSING_CURRENT = 'Enter your current password.'
const TOO_SHORT = 'New password must be at least 8 characters.'
const ONLY_SPACES = 'New password cannot be only spaces.'
const TOO_LONG = 'New password is too long. The limit is 72 bytes, and some characters count as more than one.'
const SAME_AS_CURRENT = 'New password must be different from the current one.'
const MISMATCH = 'The new passwords do not match.'

const NO_ERRORS = { currentPassword: '', newPassword: '', confirmPassword: '' }

export const NOTHING_FILLED_IN_ERRORS = {
  currentPassword: MISSING_CURRENT,
  newPassword: TOO_SHORT,
  confirmPassword: '',
}

export const FORM_CASES = [
  {
    label: 'everything right',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
    expectedErrors: NO_ERRORS,
    expectedValid: true,
  },
  {
    label: 'no current password',
    fields: { currentPassword: '', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
    expectedErrors: { ...NO_ERRORS, currentPassword: MISSING_CURRENT },
    expectedValid: false,
  },
  {
    label: 'a new password that is too short, confirmed correctly',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: 'abc1234', confirmPassword: 'abc1234' },
    expectedErrors: { ...NO_ERRORS, newPassword: TOO_SHORT },
    expectedValid: false,
  },
  {
    label: 'a new password of only spaces, confirmed correctly',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: ' '.repeat(10), confirmPassword: ' '.repeat(10) },
    expectedErrors: { ...NO_ERRORS, newPassword: ONLY_SPACES },
    expectedValid: false,
  },
  {
    label: 'a new password that is too long, confirmed correctly',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) },
    expectedErrors: { ...NO_ERRORS, newPassword: TOO_LONG },
    expectedValid: false,
  },
  {
    label: 'a new password the same as the current one, confirmed correctly',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: CURRENT_PASSWORD, confirmPassword: CURRENT_PASSWORD },
    expectedErrors: { ...NO_ERRORS, newPassword: SAME_AS_CURRENT },
    expectedValid: false,
  },
  {
    label: 'a confirmation that does not match',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: 'tatooine-sunset-43' },
    expectedErrors: { ...NO_ERRORS, confirmPassword: MISMATCH },
    expectedValid: false,
  },
  {
    label: 'a confirmation left empty',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: '' },
    expectedErrors: { ...NO_ERRORS, confirmPassword: MISMATCH },
    expectedValid: false,
  },
  {
    label: 'a confirmation that differs only by a trailing space',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: `${NEW_PASSWORD} ` },
    expectedErrors: { ...NO_ERRORS, confirmPassword: MISMATCH },
    expectedValid: false,
  },
  {
    label: 'a confirmation that differs only by capitals',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD.toUpperCase() },
    expectedErrors: { ...NO_ERRORS, confirmPassword: MISMATCH },
    expectedValid: false,
  },
  {
    label: 'a new password and a confirmation that are both wrong',
    fields: { currentPassword: CURRENT_PASSWORD, newPassword: 'short', confirmPassword: 'shorter' },
    expectedErrors: { ...NO_ERRORS, newPassword: TOO_SHORT, confirmPassword: MISMATCH },
    expectedValid: false,
  },
  {
    label: 'nothing filled in',
    fields: { currentPassword: '', newPassword: '', confirmPassword: '' },
    expectedErrors: NOTHING_FILLED_IN_ERRORS,
    expectedValid: false,
  },
  {
    label: 'no fields at all',
    fields: {},
    expectedErrors: NOTHING_FILLED_IN_ERRORS,
    expectedValid: false,
  },
]