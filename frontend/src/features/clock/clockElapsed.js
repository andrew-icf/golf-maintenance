const MS_PER_MINUTE = 60 * 1000
const MINUTES_PER_HOUR = 60

// Go sends microseconds ("23.388402"), but only three fractional digits are guaranteed to
// parse in every browser, so any extra digits are trimmed first. A cart tablet may be an
// older device.
function parseTimestamp(text) {
  if (typeof text !== 'string') {
    return NaN
  }
  return Date.parse(text.replace(/(\.\d{3})\d+/, '$1'))
}

// How long someone has been on the clock, as "42m" or "3h 12m". Nothing when the start time
// is missing or unreadable. A start time ahead of the device's clock counts as 0m.
export function formatElapsed(clockedInSince, nowMs) {
  const sinceMs = parseTimestamp(clockedInSince)
  if (Number.isNaN(sinceMs)) {
    return ''
  }

  const totalMinutes = Math.max(0, Math.floor((nowMs - sinceMs) / MS_PER_MINUTE))
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR

  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`
}