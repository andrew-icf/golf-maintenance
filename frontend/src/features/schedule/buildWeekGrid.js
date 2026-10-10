function compareByStartTime(firstShift, secondShift) {
  if (firstShift.start_time < secondShift.start_time) return -1
  if (firstShift.start_time > secondShift.start_time) return 1
  return 0
}

// Turns the roster, one week of shifts, and that week's dates into grid rows.
// Every employee gets a row and every row gets one cell per day, so the grid is
// always a full rectangle, even for people with no shifts.
export function buildWeekGrid({ roster, shifts, weekDates, currentUserId }) {
  const shiftsByCell = new Map()

  for (const shift of shifts) {
    const cellKey = `${shift.user_id}|${shift.shift_date}`
    if (!shiftsByCell.has(cellKey)) {
      shiftsByCell.set(cellKey, [])
    }
    shiftsByCell.get(cellKey).push(shift)
  }

  return roster.map((employee) => ({
    employee,
    isCurrentUser: employee.id === currentUserId,
    cells: weekDates.map((date) => {
      const cellShifts = shiftsByCell.get(`${employee.id}|${date}`) || []
      return {
        date,
        shifts: [...cellShifts].sort(compareByStartTime),
      }
    }),
  }))
}