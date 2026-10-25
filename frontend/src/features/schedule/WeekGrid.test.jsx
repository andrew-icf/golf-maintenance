import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekGrid } from './WeekGrid'
import { buildWeekGrid } from './buildWeekGrid'

// Test data. The week runs Sunday 10/18 to Saturday 10/24, and today is Wednesday 10/21.
const WEEK_DATES = [
  '2026-10-18',
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
]
const WEEK_HEADERS = [
  { weekday: 'Sun', monthDay: '10/18' },
  { weekday: 'Mon', monthDay: '10/19' },
  { weekday: 'Tue', monthDay: '10/20' },
  { weekday: 'Wed', monthDay: '10/21' },
  { weekday: 'Thu', monthDay: '10/22' },
  { weekday: 'Fri', monthDay: '10/23' },
  { weekday: 'Sat', monthDay: '10/24' },
]
const TODAY = '2026-10-21'
const TODAY_COLUMN = 3
const SUNDAY = WEEK_DATES[0]
const MONDAY = WEEK_DATES[1]
const TUESDAY = WEEK_DATES[2]
const THURSDAY = WEEK_DATES[4]

const HAN = { id: 'user-han', full_name: 'Han Solo', job_title: null }
const LEIA = { id: 'user-leia', full_name: 'Leia Organa', job_title: 'office_admin' }
const LUKE = { id: 'user-luke', full_name: 'Luke Skywalker', job_title: 'operator' }
const ROSTER = [HAN, LEIA, LUKE]

function makeShift(id, person, date, startTime, endTime) {
  return { id, user_id: person.id, shift_date: date, start_time: startTime, end_time: endTime }
}

const LUKE_MONDAY = makeShift('shift-1', LUKE, MONDAY, '06:00:00', '14:30:00')
const LEIA_THURSDAY = makeShift('shift-2', LEIA, THURSDAY, '04:00:00', '13:00:00')
const LEIA_TUESDAY_MORNING = makeShift('shift-3', LEIA, TUESDAY, '05:30:00', '14:00:00')
const LEIA_TUESDAY_EVENING = makeShift('shift-4', LEIA, TUESDAY, '17:00:00', '20:00:00')
const ALL_SHIFTS = [LUKE_MONDAY, LEIA_THURSDAY, LEIA_TUESDAY_MORNING, LEIA_TUESDAY_EVENING]

// How each shift appears in the grid
const LUKE_MONDAY_TEXT = '6am – 2:30pm'
const LEIA_THURSDAY_TEXT = '4am – 1pm'
const LEIA_MORNING_TEXT = '5:30am – 2pm'
const LEIA_EVENING_TEXT = '5pm – 8pm'
const DAY_OFF_TEXT = '—'

const LEIA_TITLE_LABEL = 'Office Admin'
const LUKE_TITLE_LABEL = 'Operator'
const EMPTY_ROSTER_MESSAGE = 'No staff to schedule yet.'
const DAYS_IN_WEEK = 7
const DAY_CELL_COUNT = ROSTER.length * DAYS_IN_WEEK

// What a screen reader announces for a clickable cell
const DAY_OFF_LABEL = 'Edit Han Solo, Sun 10/18: day off'
const SINGLE_SHIFT_LABEL = 'Edit Luke Skywalker, Mon 10/19: 6am – 2:30pm'
const SPLIT_DAY_LABEL = 'Edit Leia Organa, Tue 10/20: 5:30am – 2pm, 5pm – 8pm'

const CLICK_CASES = [
  { label: 'a cell with a shift', person: LUKE, date: MONDAY, expectedShifts: [LUKE_MONDAY] },
  { label: 'a day off', person: HAN, date: SUNDAY, expectedShifts: [] },
  {
    label: 'a split day, earliest shift first',
    person: LEIA,
    date: TUESDAY,
    expectedShifts: [LEIA_TUESDAY_MORNING, LEIA_TUESDAY_EVENING],
  },
]

// Actions
function renderGrid({ roster = ROSTER, shifts = ALL_SHIFTS, currentUserId, onCellClick } = {}) {
  const rows = buildWeekGrid({ roster, shifts, weekDates: WEEK_DATES, currentUserId })
  return render(
    <WeekGrid
      rows={ rows }
      weekDates={ WEEK_DATES }
      todayDate={ TODAY }
      onCellClick={ onCellClick }
    />
  )
}

function rowFor(person) {
  return screen.getByText(person.full_name).closest('tr')
}

function cellsFor(person) {
  return within(rowFor(person)).getAllByRole('cell')
}

function cellButton(person, date) {
  return within(rowFor(person)).getAllByRole('button')[WEEK_DATES.indexOf(date)]
}

describe('WeekGrid', () => {
  describe('layout', () => {
    it('shows a column for each day of the week with its weekday and date', () => {
      renderGrid()

      // The first column header is "Employee"
      const dayHeaders = screen.getAllByRole('columnheader').slice(1)

      expect(dayHeaders).toHaveLength(DAYS_IN_WEEK)
      dayHeaders.forEach((header, index) => {
        expect(within(header).getByText(WEEK_HEADERS[index].weekday)).toBeInTheDocument()
        expect(within(header).getByText(WEEK_HEADERS[index].monthDay)).toBeInTheDocument()
      })
    })

    it('shows one row per employee, with a job title line only for those who have one', () => {
      const { container } = renderGrid()

      for (const person of ROSTER) {
        expect(screen.getByText(person.full_name)).toBeInTheDocument()
      }
      expect(within(rowFor(LEIA)).getByText(LEIA_TITLE_LABEL)).toBeInTheDocument()
      expect(within(rowFor(LUKE)).getByText(LUKE_TITLE_LABEL)).toBeInTheDocument()
      expect(rowFor(HAN).querySelector('.employee-title')).toBeNull()
      expect(container.querySelectorAll('tbody tr')).toHaveLength(ROSTER.length)
    })

    it('gives every employee a cell for every day', () => {
      renderGrid()

      for (const person of ROSTER) {
        expect(cellsFor(person)).toHaveLength(DAYS_IN_WEEK)
      }
    })

    it('shows a message instead of a table when the roster is empty', () => {
      renderGrid({ roster: [] })

      expect(screen.getByText(EMPTY_ROSTER_MESSAGE)).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('shifts', () => {
    it('shows each shift in the right employee row and day column', () => {
      renderGrid()

      expect(cellsFor(LUKE)[WEEK_DATES.indexOf(MONDAY)]).toHaveTextContent(LUKE_MONDAY_TEXT)
      expect(cellsFor(LEIA)[WEEK_DATES.indexOf(THURSDAY)]).toHaveTextContent(LEIA_THURSDAY_TEXT)
      expect(cellsFor(HAN)[WEEK_DATES.indexOf(MONDAY)]).not.toHaveTextContent(LUKE_MONDAY_TEXT)
    })

    it('shows a dash for every day off', () => {
      renderGrid()

      for (const cell of cellsFor(HAN)) {
        expect(cell).toHaveTextContent(DAY_OFF_TEXT)
      }
      expect(cellsFor(LUKE)[WEEK_DATES.indexOf(SUNDAY)]).toHaveTextContent(DAY_OFF_TEXT)
    })

    it('stacks several shifts in one day with the earliest first, whatever order they arrive in', () => {
      renderGrid({ shifts: [LEIA_TUESDAY_EVENING, LEIA_TUESDAY_MORNING] })

      const splitDayCell = cellsFor(LEIA)[WEEK_DATES.indexOf(TUESDAY)]
      const shiftTexts = Array.from(splitDayCell.querySelectorAll('.shift')).map(
        (shift) => shift.textContent
      )

      expect(shiftTexts).toEqual([LEIA_MORNING_TEXT, LEIA_EVENING_TEXT])
    })
  })

  describe('highlights', () => {
    it("marks only today's column, in the header and in every row", () => {
      renderGrid()

      const dayHeaders = screen.getAllByRole('columnheader').slice(1)
      dayHeaders.forEach((header, index) => {
        if (index === TODAY_COLUMN) {
          expect(header).toHaveClass('today')
        } else {
          expect(header).not.toHaveClass('today')
        }
      })

      for (const person of ROSTER) {
        cellsFor(person).forEach((cell, index) => {
          if (index === TODAY_COLUMN) {
            expect(cell).toHaveClass('today')
          } else {
            expect(cell).not.toHaveClass('today')
          }
        })
      }
    })

    it("marks only the current user's row", () => {
      renderGrid({ currentUserId: LUKE.id })

      expect(rowFor(LUKE)).toHaveClass('current-user')
      expect(rowFor(LEIA)).not.toHaveClass('current-user')
      expect(rowFor(HAN)).not.toHaveClass('current-user')
    })

    it('marks no row when the current user is not on the roster', () => {
      renderGrid({ currentUserId: 'user-obi-wan' })

      for (const person of ROSTER) {
        expect(rowFor(person)).not.toHaveClass('current-user')
      }
    })
  })

  describe('read-only grid, with no click handler', () => {
    it('has no buttons and no editable cells', () => {
      const { container } = renderGrid()

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(container.querySelectorAll('.editable')).toHaveLength(0)
    })
  })

  describe('editable grid, with a click handler', () => {
    it('makes every day cell a button, and leaves names and headers alone', () => {
      const { container } = renderGrid({ onCellClick: vi.fn() })

      expect(screen.getAllByRole('button')).toHaveLength(DAY_CELL_COUNT)
      expect(container.querySelectorAll('td.editable')).toHaveLength(DAY_CELL_COUNT)
      expect(within(rowFor(LUKE)).getAllByRole('button')).toHaveLength(DAYS_IN_WEEK)
    })

    it('describes each cell for screen readers, including days off and split days', () => {
      renderGrid({ onCellClick: vi.fn() })

      expect(screen.getByRole('button', { name: DAY_OFF_LABEL })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: SINGLE_SHIFT_LABEL })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: SPLIT_DAY_LABEL })).toBeInTheDocument()
    })

    it.each(CLICK_CASES)(
      'passes the employee, date, and shifts to the handler for $label',
      async ({ person, date, expectedShifts }) => {
        const onCellClick = vi.fn()
        renderGrid({ onCellClick })

        await userEvent.click(cellButton(person, date))

        expect(onCellClick).toHaveBeenCalledTimes(1)
        expect(onCellClick).toHaveBeenCalledWith(person, date, expectedShifts)
      }
    )

    it('can be reached with Tab and opened with Enter', async () => {
      const onCellClick = vi.fn()
      renderGrid({ onCellClick })

      await userEvent.tab()
      expect(screen.getAllByRole('button')[0]).toHaveFocus()

      await userEvent.keyboard('{Enter}')

      // The first cell in the grid is the first employee on Sunday
      expect(onCellClick).toHaveBeenCalledWith(HAN, SUNDAY, [])
    })
  })
})