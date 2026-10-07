import { describe, expect, it } from 'vitest'
import { formatJobTitle } from './jobTitles'

// Test data
const KNOWN_TITLE = 'master_mechanic'
const KNOWN_TITLE_LABEL = 'Master Mechanic'
const UNKNOWN_TITLE = 'janitor'

// Every value the backend can send, mirroring the database enum
const BACKEND_JOB_TITLES = [
  'superintendent',
  'assistant_superintendent',
  'master_mechanic',
  'operator',
  'gardener',
  'landscaper',
  'mechanic',
  'office_admin',
]

describe('formatJobTitle', () => {
  it('turns a stored value into its display label', () => {
    expect(formatJobTitle(KNOWN_TITLE)).toBe(KNOWN_TITLE_LABEL)
  })

  it('returns an empty string for a user with no job title', () => {
    expect(formatJobTitle(null)).toBe('')
    expect(formatJobTitle(undefined)).toBe('')
  })

  it('returns an empty string for a value it does not recognize', () => {
    expect(formatJobTitle(UNKNOWN_TITLE)).toBe('')
  })

  it('has a label for every title the backend can send', () => {
    for (const jobTitle of BACKEND_JOB_TITLES) {
      expect(formatJobTitle(jobTitle), `missing label for ${jobTitle}`).not.toBe('')
    }
  })
})