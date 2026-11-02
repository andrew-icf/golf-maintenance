import { describe, expect, it } from 'vitest'
import { FAILURE_CASES } from '../../test/fixtures/passwordChangeCases'
import { describePasswordChangeFailure } from './passwordChangeErrors'

describe('describePasswordChangeFailure', () => {
  it.each(FAILURE_CASES)('describes $label', ({ failure, expected }) => {
    expect(describePasswordChangeFailure(failure)).toEqual(expected)
  })
})