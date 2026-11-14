import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ALL_DONE_COUNT_TEXT,
  ALL_DONE_NOTE,
  LUKES_OWN_CHECK_TEXT,
  ONE_MORE_COUNT_TEXT,
  PREVIEW_NOTICE,
  SAMPLE_COUNT_TEXT,
} from '../../../test/fixtures/checklistViewCases'
import { CHECKLIST_NAME, RESPONSIBLE_NAME } from '../../../test/fixtures/holeChecklistCases'
import { LUKE, MON_MOTHMA, YODA } from '../../../test/fixtures/taskPermissionCases'
import { ChecklistPreview } from './ChecklistPreview'
import { makeFeatures } from '../../../test/fixtures/holeFeatureCases'

// Test data. Now is 6:12am on Wednesday 2026-10-21.
const NOW = new Date(2026, 9, 21, 6, 12)

// One sample person for each of the seven duties
const DUTY_COUNT = 7

// Actions
function renderPreview(user = LUKE) {
  return render(<ChecklistPreview user={ user } />)
}

function box(label) {
  return screen.getByRole('checkbox', { name: label })
}

function metaTexts() {
  return Array.from(document.querySelectorAll('.checklist-meta')).map((element) => element.textContent)
}

function responsibleCard() {
  return screen.getByRole('region', { name: RESPONSIBLE_NAME })
}

describe('ChecklistPreview', () => {
  beforeEach(() => {
    // Only Date is faked, so timers and promises keep working normally
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says the tasks are a preview and nothing is saved', () => {
    renderPreview()

    expect(screen.getByText(PREVIEW_NOTICE)).toBeInTheDocument()
  })

  it('starts from the sample marks', () => {
    renderPreview()

    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
  })

  it('checks a task for the person, telling them "You" with the time', async () => {
    renderPreview(LUKE)

    await userEvent.click(box('Tee box: Mowed'))

    expect(box('Tee box: Mowed')).toBeChecked()
    expect(screen.getByText(ONE_MORE_COUNT_TEXT)).toBeInTheDocument()
    expect(metaTexts()).toContain(LUKES_OWN_CHECK_TEXT)
  })

  it('takes the check back when the box is unchecked again', async () => {
    renderPreview(LUKE)
    await userEvent.click(box('Tee box: Mowed'))

    await userEvent.click(box('Tee box: Mowed'))

    expect(box('Tee box: Mowed')).not.toBeChecked()
    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
    expect(metaTexts()).not.toContain(LUKES_OWN_CHECK_TEXT)
  })

  it('sets a task aside for today, and brings it back with Undo', async () => {
    renderPreview(LUKE)

    await userEvent.click(screen.getByRole('button', { name: 'Not today: Tee box: Mowed' }))

    expect(screen.getByText(ONE_MORE_COUNT_TEXT)).toBeInTheDocument()
    expect(box('Tee box: Mowed')).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Undo: Tee box: Mowed' }))

    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
    expect(box('Tee box: Mowed')).toBeEnabled()
  })

  it("lets an operator take back another operator's check", async () => {
    renderPreview(LUKE)

    await userEvent.click(box('Fairway: Fairway mowed'))

    expect(box('Fairway: Fairway mowed')).not.toBeChecked()
    expect(screen.getByText('7 of 21 tasks accounted for')).toBeInTheDocument()
  })

  it("does not let an operator touch a greenskeeper's task", async () => {
    renderPreview(LUKE)

    await userEvent.click(box('Tee box: Collect garbage'))

    expect(box('Tee box: Collect garbage')).not.toBeChecked()
    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
  })

  it('lets a greenskeeper check a greenskeeper task', async () => {
    renderPreview(YODA)

    await userEvent.click(box('Green: Ball marks'))

    expect(box('Green: Ball marks')).toBeChecked()
    expect(screen.getByText(ONE_MORE_COUNT_TEXT)).toBeInTheDocument()
  })

  it('lets an admin check a greenskeeper task', async () => {
    renderPreview(MON_MOTHMA)

    await userEvent.click(box('Tee box: Collect garbage'))

    expect(box('Tee box: Collect garbage')).toBeChecked()
    expect(metaTexts()).toContain(LUKES_OWN_CHECK_TEXT)
  })

  it('is complete once every task is accounted for', async () => {
    renderPreview(MON_MOTHMA)
    const openBoxes = screen.getAllByRole('checkbox').filter((checkbox) => !checkbox.checked && !checkbox.disabled)

    for (const openBox of openBoxes) {
      await userEvent.click(openBox)
    }

    expect(screen.getByText(ALL_DONE_COUNT_TEXT)).toBeInTheDocument()
    expect(screen.getByText(ALL_DONE_NOTE)).toBeInTheDocument()
  })

  it('forgets everything when it is shown again', async () => {
    const { unmount } = renderPreview(LUKE)
    await userEvent.click(box('Tee box: Mowed'))
    unmount()

    renderPreview(LUKE)

    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()
    expect(box('Tee box: Mowed')).not.toBeChecked()
  })

  describe('who is responsible', () => {
    it('shows the card first, then the notice, then the checklist', () => {
      renderPreview(MON_MOTHMA)
      const notice = screen.getByText(PREVIEW_NOTICE)
      const checklist = screen.getByRole('region', { name: CHECKLIST_NAME })

      expect(responsibleCard().compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(notice.compareDocumentPosition(checklist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('names one sample person for every duty on the checklist', () => {
      renderPreview(MON_MOTHMA)

      expect(responsibleCard().querySelectorAll('.responsible-tile')).toHaveLength(DUTY_COUNT)
      expect(within(responsibleCard()).getByText('Yoda')).toBeInTheDocument()
      expect(within(responsibleCard()).getByText('Wedge Antilles')).toBeInTheDocument()
    })

    it('puts an operator on the Greens duty, marked as them', () => {
      renderPreview(LUKE)

      expect(within(responsibleCard()).getByText('Luke Skywalker (you)')).toBeInTheDocument()
      expect(within(responsibleCard()).queryByText('Wedge Antilles')).not.toBeInTheDocument()
      expect(within(responsibleCard()).getAllByText(/\(you\)/)).toHaveLength(1)
    })

    it('puts a greenskeeper on the greenskeeper tasks, marked as them', () => {
      renderPreview(YODA)

      expect(within(responsibleCard()).getByText('Yoda (you)')).toBeInTheDocument()
      expect(within(responsibleCard()).getAllByText(/\(you\)/)).toHaveLength(1)
    })

    it('marks nobody as the viewer when they are an admin', () => {
      renderPreview(MON_MOTHMA)

      expect(within(responsibleCard()).queryByText(/\(you\)/)).not.toBeInTheDocument()
    })
  })

  describe('the features of the hole', () => {
  it('builds the tasks from the features it is given, leaving out bunkers a hole lacks', () => {
    render(<ChecklistPreview user={ LUKE } features={ makeFeatures() } />)

    // The 5 sample marks on tasks this hole has, and the 3 set aside, out of 15 tasks
    expect(screen.getByText('7 of 15 tasks accounted for')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 4, name: 'Bunkers' })).not.toBeInTheDocument()
  })

  it('shows a section for each bunker the hole has', () => {
    render(<ChecklistPreview user={ LUKE } features={ makeFeatures([1, 2, 3, 4, 5]) } />)

    const sections = screen.getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)

    expect(sections.filter((text) => text.startsWith('Bunker '))).toEqual([
      'Bunker 1',
      'Bunker 2',
      'Bunker 3',
      'Bunker 4',
      'Bunker 5',
    ])
  })

  it('shows no tasks, and no list of who is responsible, for a hole with no features', () => {
    render(<ChecklistPreview user={ LUKE } features={ [] } />)

    expect(screen.getByText('There are no tasks for this hole today.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: RESPONSIBLE_NAME })).not.toBeInTheDocument()
  })

  it('builds a new checklist when the features change', () => {
    const { rerender } = render(<ChecklistPreview user={ LUKE } />)
    expect(screen.getByText(SAMPLE_COUNT_TEXT)).toBeInTheDocument()

    rerender(<ChecklistPreview user={ LUKE } features={ makeFeatures() } />)

    expect(screen.getByText('7 of 15 tasks accounted for')).toBeInTheDocument()
  })
})
})