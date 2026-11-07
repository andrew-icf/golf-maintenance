import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ALL_DONE_COUNT_TEXT,
  ALL_DONE_NOTE,
  LUKES_OWN_CHECK_TEXT,
  ONE_MORE_COUNT_TEXT,
  PREVIEW_NOTICE,
  SAMPLE_COUNT_TEXT,
} from '../../../test/fixtures/checklistViewCases'
import { LUKE, MON_MOTHMA, YODA } from '../../../test/fixtures/taskPermissionCases'
import { ChecklistPreview } from './ChecklistPreview'

// Test data. Now is 6:12am on Wednesday 2026-10-21.
const NOW = new Date(2026, 9, 21, 6, 12)

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
})