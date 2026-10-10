import { describe, expect, it } from 'vitest'
import { buildWeekGrid } from './buildWeekGrid'

// Test data. The week runs Sunday 2026-10-04 to Saturday 2026-10-10.
const WEEK_DATES = [
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
]
const MONDAY = WEEK_DATES[1]
const WEDNESDAY = WEEK_DATES[3]
const DATE_BEFORE_WEEK = '2026-10-03'
const DATE_AFTER_WEEK = '2026-10-11'

const ALEX = { id: 'user-alex', full_name: 'Alex Rivera', job_title: 'mechanic' }
const CASEY = { id: 'user-casey', full_name: 'Casey Brooks', job_title: null }
const DANA = { id: 'user-dana', full_name: 'Dana Whitfield', job_title: 'gardener' }
const ROSTER = [ALEX, CASEY, DANA]
const ADMIN_ID = 'user-admin'

function makeShift({ id, userId, date, startTime = '07:00:00', endTime = '15:00:00' }) {
  return { id, user_id: userId, shift_date: date, start_time: startTime, end_time: endTime }
}

const ALEX_MONDAY = makeShift({ id: 'shift-1', userId: ALEX.id, date: MONDAY })
const ALEX_WEDNESDAY = makeShift({
  id: 'shift-2',
  userId: ALEX.id,
  date: WEDNESDAY,
  startTime: '04:00:00',
  endTime: '13:00:00',
})
const CASEY_MONDAY = makeShift({ id: 'shift-3', userId: CASEY.id, date: MONDAY })
const ALEX_MONDAY_MORNING = makeShift({
  id: 'shift-4',
  userId: ALEX.id,
  date: MONDAY,
  startTime: '04:00:00',
  endTime: '08:00:00',
})
const ALEX_MONDAY_EVENING = makeShift({
  id: 'shift-5',
  userId: ALEX.id,
  date: MONDAY,
  startTime: '17:00:00',
  endTime: '20:00:00',
})
const ADMIN_MONDAY = makeShift({ id: 'shift-6', userId: ADMIN_ID, date: MONDAY })
const ALEX_BEFORE_WEEK = makeShift({ id: 'shift-7', userId: ALEX.id, date: DATE_BEFORE_WEEK })
const ALEX_AFTER_WEEK = makeShift({ id: 'shift-8', userId: ALEX.id, date: DATE_AFTER_WEEK })

const NO_CURRENT_USER_CASES = [
  { label: 'is null', currentUserId: null },
  { label: 'is undefined', currentUserId: undefined },
  { label: 'is not on the roster', currentUserId: 'user-unknown' },
  { label: 'is an admin, who is never on the roster', currentUserId: ADMIN_ID },
]

const CREW_SIZE = 25
const FULL_CREW = Array.from({ length: CREW_SIZE }, (unusedItem, index) => ({
  id: `crew-${index}`,
  full_name: `Crew Member ${index}`,
  job_title: null,
}))
const FULL_CREW_SHIFTS = FULL_CREW.map((employee, index) =>
  makeShift({
    id: `crew-shift-${index}`,
    userId: employee.id,
    date: WEEK_DATES[index % WEEK_DATES.length],
  })
)

// currentUserId deliberately has no default, so a test can pass undefined on purpose
function buildGrid({ roster = ROSTER, shifts = [], weekDates = WEEK_DATES, currentUserId } = {}) {
  return buildWeekGrid({ roster, shifts, weekDates, currentUserId })
}

function findRow(grid, employeeId) {
  return grid.find((row) => row.employee.id === employeeId)
}

function findCell(grid, employeeId, date) {
  return findRow(grid, employeeId).cells.find((cell) => cell.date === date)
}

function shiftIdsIn(grid, employeeId, date) {
  return findCell(grid, employeeId, date).shifts.map((shift) => shift.id)
}

function countShifts(grid) {
  return grid
    .flatMap((row) => row.cells)
    .reduce((total, cell) => total + cell.shifts.length, 0)
}

describe('buildWeekGrid', () => {
  it('creates one row per roster member, in roster order', () => {
    const grid = buildGrid()

    expect(grid.map((row) => row.employee.id)).toEqual([ALEX.id, CASEY.id, DANA.id])
  })

  it('gives every row one cell per day of the week, in order, empty when there are no shifts', () => {
    const grid = buildGrid()

    for (const row of grid) {
      expect(row.cells.map((cell) => cell.date)).toEqual(WEEK_DATES)
      expect(row.cells.every((cell) => cell.shifts.length === 0)).toBe(true)
    }
  })

  it('places each shift in the right employee row and day cell', () => {
    const grid = buildGrid({ shifts: [ALEX_MONDAY, ALEX_WEDNESDAY, CASEY_MONDAY] })

    expect(shiftIdsIn(grid, ALEX.id, MONDAY)).toEqual([ALEX_MONDAY.id])
    expect(shiftIdsIn(grid, ALEX.id, WEDNESDAY)).toEqual([ALEX_WEDNESDAY.id])
    expect(shiftIdsIn(grid, CASEY.id, MONDAY)).toEqual([CASEY_MONDAY.id])
    expect(countShifts(grid)).toBe(3)
  })

  it("keeps different people's shifts on the same day separate", () => {
    const grid = buildGrid({ shifts: [ALEX_MONDAY, CASEY_MONDAY] })

    expect(shiftIdsIn(grid, ALEX.id, MONDAY)).toEqual([ALEX_MONDAY.id])
    expect(shiftIdsIn(grid, CASEY.id, MONDAY)).toEqual([CASEY_MONDAY.id])
    expect(shiftIdsIn(grid, DANA.id, MONDAY)).toEqual([])
  })

  it('orders several shifts in one day by start time, whatever order they arrive in', () => {
    const grid = buildGrid({ shifts: [ALEX_MONDAY_EVENING, ALEX_MONDAY_MORNING] })

    expect(shiftIdsIn(grid, ALEX.id, MONDAY)).toEqual([
      ALEX_MONDAY_MORNING.id,
      ALEX_MONDAY_EVENING.id,
    ])
  })

  it('ignores shifts for people who are not on the roster', () => {
    const grid = buildGrid({ shifts: [ADMIN_MONDAY, ALEX_MONDAY] })

    expect(countShifts(grid)).toBe(1)
    expect(shiftIdsIn(grid, ALEX.id, MONDAY)).toEqual([ALEX_MONDAY.id])
  })

  it('ignores shifts that fall outside the displayed week', () => {
    const grid = buildGrid({ shifts: [ALEX_BEFORE_WEEK, ALEX_MONDAY, ALEX_AFTER_WEEK] })

    expect(countShifts(grid)).toBe(1)
    expect(shiftIdsIn(grid, ALEX.id, MONDAY)).toEqual([ALEX_MONDAY.id])
  })

  it("flags only the current user's row", () => {
    const grid = buildGrid({ currentUserId: CASEY.id })

    expect(grid.map((row) => row.isCurrentUser)).toEqual([false, true, false])
  })

  it.each(NO_CURRENT_USER_CASES)('flags nobody when the current user $label', ({ currentUserId }) => {
    const grid = buildGrid({ currentUserId })

    expect(grid.some((row) => row.isCurrentUser)).toBe(false)
  })

  it('passes the original employee and shift objects through, so the editor can use their ids', () => {
    const grid = buildGrid({ shifts: [ALEX_MONDAY] })

    expect(findRow(grid, ALEX.id).employee).toBe(ALEX)
    expect(findCell(grid, ALEX.id, MONDAY).shifts[0]).toBe(ALEX_MONDAY)
  })

  it('does not modify the roster, shifts, or dates it is given', () => {
    // Frozen arrays throw if the function tries to sort or push into them
    const frozenRoster = Object.freeze([...ROSTER])
    const frozenShifts = Object.freeze([ALEX_MONDAY_EVENING, ALEX_MONDAY_MORNING])
    const frozenDates = Object.freeze([...WEEK_DATES])

    buildWeekGrid({
      roster: frozenRoster,
      shifts: frozenShifts,
      weekDates: frozenDates,
      currentUserId: null,
    })

    expect(frozenShifts.map((shift) => shift.id)).toEqual([
      ALEX_MONDAY_EVENING.id,
      ALEX_MONDAY_MORNING.id,
    ])
    expect(frozenRoster).toEqual(ROSTER)
    expect(frozenDates).toEqual(WEEK_DATES)
  })

  it('returns no rows when the roster is empty', () => {
    const grid = buildGrid({ roster: [], shifts: [ALEX_MONDAY] })

    expect(grid).toEqual([])
  })

  it('places every shift correctly for a full crew of 25', () => {
    const grid = buildGrid({ roster: FULL_CREW, shifts: FULL_CREW_SHIFTS })

    expect(grid).toHaveLength(CREW_SIZE)
    expect(countShifts(grid)).toBe(CREW_SIZE)
    FULL_CREW.forEach((employee, index) => {
      const expectedDate = WEEK_DATES[index % WEEK_DATES.length]
      expect(shiftIdsIn(grid, employee.id, expectedDate)).toEqual([`crew-shift-${index}`])
    })
  })
})