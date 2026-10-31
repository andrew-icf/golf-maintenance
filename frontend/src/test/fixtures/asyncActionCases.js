export const FAILURE_MESSAGE = 'The server said no'
export const DEFAULT_FAILURE_MESSAGE = 'Something went wrong. Try again.'
export const CUSTOM_FALLBACK_MESSAGE = 'Could not clock in. Try again.'

// Failures that carry no usable message
export const MESSAGELESS_FAILURE_CASES = [
  { label: 'undefined', failure: undefined },
  { label: 'null', failure: null },
  { label: 'plain text instead of an error', failure: 'boom' },
  { label: 'an error with an empty message', failure: new Error('') },
]