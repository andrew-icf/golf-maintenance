import { addDays, formatDayLabel, formatShiftRange } from '../schedule/scheduleDates'

// Groups a person's shifts into the days of a window that starts on startDate and runs
// dayCount days. Each day carries the labels the screen needs, whether it is today, and its
// shifts in start-time order. A shift outside the window is left out.
export function buildShiftDays(shifts, startDate, dayCount, today) {
  if (!Number.isInteger(dayCount) || dayCount < 1) {
    return []
  }

  const shiftsByDate = new Map()
  for (const shift of shifts ?? []) {
    if (!shiftsByDate.has(shift.shift_date)) {
      shiftsByDate.set(shift.shift_date, [])
    }
    shiftsByDate.get(shift.shift_date).push(shift)
  }

  return Array.from({ length: dayCount }, (unusedItem, dayOffset) => {
    const date = addDays(startDate, dayOffset)
    const shiftsOnDate = [...(shiftsByDate.get(date) ?? [])].sort((earlier, later) =>
      earlier.start_time.localeCompare(later.start_time)
    )

    return {
      date,
      ...formatDayLabel(date),
      isToday: date === today,
      shifts: shiftsOnDate.map((shift) => ({
        id: shift.id,
        text: formatShiftRange(shift.start_time, shift.end_time),
      })),
    }
  })
}

// The shifts of the day marked as today, or none when today is not in the window
export function todaysShifts(days) {
  return days.find((day) => day.isToday)?.shifts ?? []
}
