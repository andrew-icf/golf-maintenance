import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { atTime, doneMark, makeChecklistItem } from '../../../test/fixtures/checklistCases'
import { ONE_ROLE_ITEMS, VIEWER_CASES } from '../../../test/fixtures/checklistLayoutCases'
import {
  ACTION_COUNT_CASES,
  ALL_DONE_COUNT_TEXT,
  ALL_DONE_NOTE,
  DONE_DESCRIPTIONS,
  ENABLED_COUNT_CASES,
  EXPECTED_AREA_HEADINGS,
  EXPECTED_CHECKBOX_LABELS,
  EXPECTED_SECTION_HEADINGS,
  LOCK_CASES,
  LUKES_OWN_CHECK,
  LUKES_OWN_CHECK_TEXT,
  NO_TASKS_NOTE,
  SAMPLE_COUNT_TEXT,
  SAMPLE_DAY,
  SET_ASIDE_COUNT,
} from '../../../test/fixtures/checklistViewCases'
import { AHSOKA, LUKE, MON_MOTHMA } from '../../../test/fixtures/taskPermissionCases'
import { Checklist } from './Checklist'
import { buildSampleMarks } from './checklistMarks'
import { buildChecklistItems } from './checklistTasks'

// Test data
const ITEMS = buildChecklistItems()
const MARKS = buildSampleMarks(SAMPLE_DAY)

// Actions
function renderChecklist({
  items = ITEMS,
  marks = MARKS,
  user = LUKE,
  onCheck = vi.fn(),
  onSkip = vi.fn(),
  onUndo = vi.fn(),
} = {}) {
  render(<Checklist items={ items } marks={ marks } user={ user } onCheck={ onCheck } onSkip={ onSkip } onUndo={ onUndo } />)
  return { onCheck, onSkip, onUndo }
}

function box(label) {
  return screen.getByRole('checkbox', { name: label })
}

function columnHeads() {
  return Array.from(document.querySelectorAll('.checklist-head'))
}

function metaTexts() {
  return Array.from(document.querySelectorAll('.checklist-meta')).map((element) => element.textContent)
}

describe('Checklist', () => {
  describe('the progress line', () => {
    it('says how many tasks are accounted for, and how they split', () => {
      renderChecklist()

      expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
      expect(screen.getByText(/5 done · 3 not today\./)).toBeInTheDocument()
    })

    it('fills the progress bar to match', () => {
      renderChecklist()

      const bar = screen.getByRole('progressbar', { name: 'Tasks accounted for' })

      expect(bar).toHaveAttribute('aria-valuenow', '8')
      expect(bar).toHaveAttribute('aria-valuemax', '21')
    })

    it('says every task is accounted for when they all are', () => {
      const allDone = new Map(ITEMS.map((item) => [item.id, doneMark('user-1', 'Someone', atTime(7, 0))]))

      renderChecklist({ marks: allDone })

      expect(screen.getByText(ALL_DONE_COUNT_TEXT)).toBeInTheDocument()
      expect(screen.getByText(ALL_DONE_NOTE)).toBeInTheDocument()
    })

    it('says there are no tasks, with no bar and no columns, when there are none', () => {
      renderChecklist({ items: [], marks: new Map() })

      expect(screen.getByText(NO_TASKS_NOTE)).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(columnHeads()).toHaveLength(0)
    })

    it('says task, not tasks, for a checklist of one', () => {
      renderChecklist({ items: [makeChecklistItem({ id: 'only' })], marks: new Map() })

      expect(screen.getByText('0 of 1 task accounted for')).toBeInTheDocument()
    })
  })

  describe('the columns', () => {
    it('shows a Greenskeeper header and an Operator header, in that order', () => {
      renderChecklist()

      expect(columnHeads().map((head) => head.textContent.replace('Your tasks', ''))).toEqual([
        'Greenskeeper',
        'Operator',
      ])
    })

    it.each(VIEWER_CASES)('tags the right columns as theirs for $name', ({ user, expectedYours }) => {
      renderChecklist({ user })

      expect(columnHeads().map((head) => head.textContent.includes('Your tasks'))).toEqual(expectedYours)
    })

    it('tags no column, and enables no box, when nobody is looking', () => {
      renderChecklist({ user: null })

      expect(columnHeads().some((head) => head.textContent.includes('Your tasks'))).toBe(false)
      expect(screen.getAllByRole('checkbox').every((checkbox) => checkbox.disabled)).toBe(true)
    })

    it('shows a single column for a checklist of one role', () => {
      renderChecklist({ items: ONE_ROLE_ITEMS, marks: new Map() })

      expect(columnHeads()).toHaveLength(1)
      expect(columnHeads()[0].textContent).toContain('Operator')
    })
  })

  describe('the areas and sections', () => {
    it('labels each area, with the sections under it', () => {
      renderChecklist()

      expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
        EXPECTED_AREA_HEADINGS
      )
      expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(
        EXPECTED_SECTION_HEADINGS
      )
    })

    it('names every checkbox with its area and section, in the order the page reads them', () => {
      renderChecklist()

      expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-label'))).toEqual(
        EXPECTED_CHECKBOX_LABELS
      )
    })
  })

  describe('who can check what', () => {
    it.each(ENABLED_COUNT_CASES)('enables the right boxes for $name', ({ user, expected }) => {
      renderChecklist({ user })

      expect(screen.getAllByRole('checkbox').filter((checkbox) => !checkbox.disabled)).toHaveLength(expected)
    })

    it.each(LOCK_CASES)(
      'locks the open tasks $name may not check, saying who they are for',
      ({ user, greenskeeperLocks, operatorLocks }) => {
        renderChecklist({ user })

        expect(screen.queryAllByRole('img', { name: 'Locked: for Greenskeeper' })).toHaveLength(greenskeeperLocks)
        expect(screen.queryAllByRole('img', { name: 'Locked: for Operator' })).toHaveLength(operatorLocks)
      }
    )

    it.each(ACTION_COUNT_CASES)('offers $name the right Not today and Undo buttons', ({ user, notToday, undo }) => {
      renderChecklist({ user })

      expect(screen.queryAllByRole('button', { name: /^Not today:/ })).toHaveLength(notToday)
      expect(screen.queryAllByRole('button', { name: /^Undo:/ })).toHaveLength(undo)
    })
  })

  describe('what it shows for each task', () => {
    it('shows who checked each task, and when', () => {
      renderChecklist()

      for (const description of DONE_DESCRIPTIONS) {
        expect(metaTexts(), description).toContain(description)
      }
    })

    it('says Not today under each task that was set aside', () => {
      renderChecklist()

      expect(metaTexts().filter((text) => text === 'Not today')).toHaveLength(SET_ASIDE_COUNT)
    })

    it("says You under the viewer's own checks", () => {
      const marks = new Map(MARKS).set(LUKES_OWN_CHECK.id, LUKES_OWN_CHECK.mark)

      renderChecklist({ marks })

      expect(metaTexts()).toContain(LUKES_OWN_CHECK_TEXT)
    })

    it('checks the box of each done task and no other', () => {
      renderChecklist()

      expect(screen.getAllByRole('checkbox').filter((checkbox) => checkbox.checked)).toHaveLength(5)
    })

    it('leaves the box of a task set aside unchecked and disabled', () => {
      renderChecklist()

      expect(box('Fairway: Fairway sprayed')).not.toBeChecked()
      expect(box('Fairway: Fairway sprayed')).toBeDisabled()
    })
  })

  describe('using it', () => {
    it('reports a check on an open task', async () => {
      const { onCheck, onUndo } = renderChecklist()

      await userEvent.click(box('Tee box: Mowed'))

      expect(onCheck).toHaveBeenCalledTimes(1)
      expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ id: 'tee-box-mowed' }))
      expect(onUndo).not.toHaveBeenCalled()
    })

    it('reports an undo when a done task is unchecked', async () => {
      const { onCheck, onUndo } = renderChecklist()

      await userEvent.click(box('Fairway: Fairway mowed'))

      expect(onUndo).toHaveBeenCalledTimes(1)
      expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: 'fairway-mowed' }))
      expect(onCheck).not.toHaveBeenCalled()
    })

    it('reports a task set aside from its Not today button', async () => {
      const { onSkip } = renderChecklist()

      await userEvent.click(screen.getByRole('button', { name: 'Not today: Tee box: Mowed' }))

      expect(onSkip).toHaveBeenCalledTimes(1)
      expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ id: 'tee-box-mowed' }))
    })

    it('reports an undo from the Undo button on a task set aside', async () => {
      const { onUndo } = renderChecklist()

      await userEvent.click(screen.getByRole('button', { name: 'Undo: Fairway: Fairway sprayed' }))

      expect(onUndo).toHaveBeenCalledTimes(1)
      expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: 'fairway-sprayed' }))
    })

    it('reports nothing when a locked box is clicked', async () => {
      const { onCheck, onSkip, onUndo } = renderChecklist({ user: LUKE })

      await userEvent.click(box('Tee box: Collect garbage'))

      expect(onCheck).not.toHaveBeenCalled()
      expect(onSkip).not.toHaveBeenCalled()
      expect(onUndo).not.toHaveBeenCalled()
    })

    it('lets an admin check a greenskeeper task', async () => {
      const { onCheck } = renderChecklist({ user: MON_MOTHMA })

      await userEvent.click(box('Tee box: Collect garbage'))

      expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ id: 'collect-garbage' }))
    })
  })

  it('locks every open task for someone who checks nothing, with no Not today buttons', () => {
    renderChecklist({ user: AHSOKA })

    expect(screen.queryAllByRole('img', { name: /^Locked:/ })).toHaveLength(13)
    expect(screen.queryAllByRole('button', { name: /^Not today:/ })).toHaveLength(0)
  })
})