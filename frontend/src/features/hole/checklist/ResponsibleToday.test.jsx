import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  CHIP_ASSIGNMENTS,
  DUTIES,
  FULL_ASSIGNMENTS,
  FULL_ASSIGNMENT_NAMES,
  LUKE_PERSON,
  MARKUP_ASSIGNMENTS,
  MARKUP_NAME,
  NO_DUTIES_CASES,
  RESPONSIBLE_NOTE,
  SEVERAL_PEOPLE_ASSIGNMENTS,
} from '../../../test/fixtures/responsibleTodayCases'
import { LUKE, MON_MOTHMA } from '../../../test/fixtures/taskPermissionCases'
import { ResponsibleToday } from './ResponsibleToday'

// Actions
// Actions
function renderResponsible(overrides = {}) {
  const { assignments = FULL_ASSIGNMENTS, user = MON_MOTHMA } = overrides
  // An undefined list of duties is a case worth testing, so a default cannot be allowed to
  // replace it. Only a list that was never passed gets the full set.
  const duties = 'duties' in overrides ? overrides.duties : DUTIES

  return render(<ResponsibleToday duties={ duties } assignments={ assignments } user={ user } />)
}

// The tile for a duty, found by the duty's name
function tile(dutyTitle) {
  return screen.getByText(dutyTitle).closest('li')
}

describe('ResponsibleToday', () => {
  it('is a section named by its heading, with the explanation under it', () => {
    renderResponsible()

    expect(screen.getByRole('region', { name: 'Responsible today' })).toBeInTheDocument()
    expect(screen.getByText(RESPONSIBLE_NOTE)).toBeInTheDocument()
  })

  it('shows each duty with the person answerable for it', () => {
    renderResponsible()

    DUTIES.forEach((duty, index) => {
      for (const name of FULL_ASSIGNMENT_NAMES[index]) {
        expect(within(tile(duty.title)).getByText(name), duty.title).toBeInTheDocument()
      }
    })
  })

  it("tells the viewer which entry is theirs, and no other", () => {
    renderResponsible({ user: LUKE })

    expect(within(tile('Greens')).getByText('Luke Skywalker (you)')).toBeInTheDocument()
    expect(within(tile('Rolling')).getByText('Han Solo')).toBeInTheDocument()
    expect(screen.getAllByText(/\(you\)/)).toHaveLength(1)
  })

  it('says Not assigned for a duty nobody has', () => {
    renderResponsible({ assignments: new Map([['greens', [LUKE_PERSON]]]) })

    expect(screen.getAllByText('Not assigned')).toHaveLength(DUTIES.length - 1)
    expect(within(tile('Greens')).queryByText('Not assigned')).not.toBeInTheDocument()
  })

  it('lists several people for one duty', () => {
    renderResponsible({ assignments: SEVERAL_PEOPLE_ASSIGNMENTS })

    const bunkers = tile('Bunkers')

    expect(within(bunkers).getByText('Han Solo')).toBeInTheDocument()
    expect(within(bunkers).getByText('Luke Skywalker')).toBeInTheDocument()
    expect(within(bunkers).getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows a role chip only for a person with a job title it knows', () => {
    renderResponsible({ assignments: CHIP_ASSIGNMENTS })

    const rolling = tile('Rolling')

    expect(within(rolling).getByText('Han Solo')).toBeInTheDocument()
    expect(within(rolling).getByText('No Title')).toBeInTheDocument()
    expect(within(rolling).getByText('Smuggler')).toBeInTheDocument()
    expect(within(rolling).getAllByText('Operator')).toHaveLength(1)
    expect(rolling.querySelectorAll('.person-chip')).toHaveLength(1)
  })

  it.each(NO_DUTIES_CASES)('shows nothing when the duties are $label', ({ duties }) => {
    renderResponsible({ duties })

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.queryByText('Responsible today')).not.toBeInTheDocument()
  })

  it('lists the duties in the order it is given them', () => {
    renderResponsible({ duties: [...DUTIES].reverse() })

    const titles = Array.from(document.querySelectorAll('.responsible-duty')).map((element) => element.textContent)

    expect(titles).toEqual([...DUTIES].reverse().map((duty) => duty.title))
  })

  it('shows a name as text, never as markup', () => {
    const { container } = renderResponsible({ assignments: MARKUP_ASSIGNMENTS })

    expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })
})