import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_PASSWORD_CASES,
  CURRENT_PASSWORD,
  EXPECTED_MAX_BYTES,
  EXPECTED_MIN_LENGTH,
  FORM_CASES,
  NOT_TEXT_CASES,
  NOTHING_FILLED_IN_ERRORS,
  REFUSED_PASSWORD_CASES,
} from '../../test/fixtures/passwordCases'
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  findPasswordProblem,
  validatePasswordForm,
} from './passwordRules'

describe('the limits', () => {
  it("are the ones the server enforces", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(EXPECTED_MIN_LENGTH)
    expect(MAX_PASSWORD_BYTES).toBe(EXPECTED_MAX_BYTES)
  })
})

describe('findPasswordProblem', () => {
  it.each(ACCEPTED_PASSWORD_CASES)('accepts $label', ({ newPassword }) => {
    expect(findPasswordProblem(newPassword, CURRENT_PASSWORD)).toBeNull()
  })

  it.each(REFUSED_PASSWORD_CASES)('refuses $label as $expected', ({ newPassword, expected }) => {
    expect(findPasswordProblem(newPassword, CURRENT_PASSWORD)).toBe(expected)
  })

  it('checks length before sameness', () => {
    // A short password that is also the current one is told it is too short, not the same
    expect(findPasswordProblem('short', 'short')).toBe('too_short')
  })

  it.each(NOT_TEXT_CASES)('treats $label as nothing typed', ({ newPassword }) => {
    expect(findPasswordProblem(newPassword, CURRENT_PASSWORD)).toBe('too_short')
  })
})

describe('validatePasswordForm', () => {
  it.each(FORM_CASES)('reports $label', ({ fields, expectedErrors, expectedValid }) => {
    const result = validatePasswordForm(fields)

    expect(result.errors).toEqual(expectedErrors)
    expect(result.isValid).toBe(expectedValid)
  })

  it('copes with being given nothing at all', () => {
    const result = validatePasswordForm()

    expect(result.errors).toEqual(NOTHING_FILLED_IN_ERRORS)
    expect(result.isValid).toBe(false)
  })
})