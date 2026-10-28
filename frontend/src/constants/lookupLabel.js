// A value with no label is shown as it arrived, so a missing label is visible instead of
// blank. Anything that isn't text shows nothing.
export function lookupLabel(labels, value) {
  if (typeof value !== 'string') {
    return ''
  }
  return Object.hasOwn(labels, value) ? labels[value] : value
}