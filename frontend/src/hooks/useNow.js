import { useEffect, useState } from 'react'

const ONE_MINUTE_MS = 60 * 1000

// The current time in milliseconds, refreshed on an interval (every minute unless told
// otherwise), so something like "3h 12m on the clock" keeps itself current.
export function useNow(intervalMs = ONE_MINUTE_MS) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}