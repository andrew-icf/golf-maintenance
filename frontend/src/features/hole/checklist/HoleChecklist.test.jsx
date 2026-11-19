import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../../api'
import { CHECKLIST_NAME, RESPONSIBLE_NAME } from '../../../test/fixtures/holeChecklistCases'
import { SAMPLE_TASK_LIST } from '../../../test/fixtures/holeTaskCases'
import { MARKED_AT, makeServerMark } from '../../../test/fixtures/serverMarkCases'
import { LUKE, MON_MOTHMA } from '../../../test/fixtures/taskPermissionCases'
import { createDeferred } from '../../../test/helpers'
import { buildSampleFeatures } from './checklistTasks'
import { HoleChecklist } from './HoleChecklist'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getHoleMarks: vi.fn(), setTaskMark: vi.fn(), clearTaskMark: vi.fn() },
}))

// The real ApiError stays, and only the calls to the server are replaced
vi.mock('../../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: apiMock,
}))

const HOLE_ID = 'hole-C7'
const CLUB_DATE = '2026-11-17'
const LOADING_TEXT = 'Loading today’s checks…'
const SAVING_TEXT = 'Saving…'
const SAMPLE_NOTE = 'The people under Responsible today are samples until assignments are set up.'
const NO_TASKS_TEXT = 'There are no tasks for this hole today.'
const STALE_LIST_TEXT = 'Saved, but the list couldn’t refresh. Reopen the hole to see the latest.'

// Marks as the server sends them. Yoda checked the tee box mowing at 5:48am, and Luke checked the
// rough at 6:12am.
const YODAS_MOWING = makeServerMark('tee-box-mowed')
const LUKES_MOWING = makeServerMark('tee-box-mowed', {
  user_id: LUKE.id,
  user_name: 'Luke Skywalker',
  marked_at: MARKED_AT,
})
const LUKES_ROUGH = makeServerMark('rough-mowed', {
  user_id: LUKE.id,
  user_name: 'Luke Skywalker',
  marked_at: MARKED_AT,
})
const DINS_SPRAYING = makeServerMark('fairway-sprayed', {
  status: 'not_today',
  user_id: 'user-din',
  user_name: 'Din Djarin',
})

// Actions
function marksResponse(marks) {
  return { date: CLUB_DATE, marks }
}

function renderPage({ user = LUKE, features = buildSampleFeatures() } = {}) {
  render(<HoleChecklist holeId={ HOLE_ID } user={ user } features={ features } taskList={ SAMPLE_TASK_LIST } />)
}

// Renders the checklist and waits for the marks to arrive. marks is what the server sends the first time.
async function renderLoaded({ marks = [], ...options } = {}) {
  apiMock.getHoleMarks.mockResolvedValue(marksResponse(marks))
  renderPage(options)
  await screen.findByRole('region', { name: CHECKLIST_NAME })
}

function box(label) {
  return screen.getByRole('checkbox', { name: label })
}

function rowOf(label) {
  return box(label).closest('li')
}

function metaTexts() {
  return Array.from(document.querySelectorAll('.checklist-meta')).map((element) => element.textContent)
}

describe('HoleChecklist', () => {
  beforeEach(() => {
    apiMock.getHoleMarks.mockReset()
    apiMock.setTaskMark.mockReset()
    apiMock.clearTaskMark.mockReset()
  })

  describe('loading the marks', () => {
    it('says it is loading, and holds the checklist back, until the marks arrive', async () => {
      const marks = createDeferred()
      apiMock.getHoleMarks.mockReturnValue(marks.promise)

      renderPage()

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: CHECKLIST_NAME })).not.toBeInTheDocument()
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)

      await act(async () => {
        marks.resolve(marksResponse([]))
      })

      expect(await screen.findByRole('region', { name: CHECKLIST_NAME })).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
    })

    it('shows every task open once the marks arrive and there are none', async () => {
      await renderLoaded()

      expect(screen.getByText('0 of 21 tasks accounted for')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox').filter((checkbox) => checkbox.checked)).toHaveLength(0)
    })

    it('asks for the hole’s marks, by the hole’s id, once', async () => {
      await renderLoaded()

      expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(1)
      expect(apiMock.getHoleMarks).toHaveBeenCalledWith(HOLE_ID)
    })

    it('says which day the checks are for', async () => {
      await renderLoaded()

      expect(screen.getByText('Checks for Tuesday, November 17')).toBeInTheDocument()
    })

    it('leaves the day out when the server sends none', async () => {
      apiMock.getHoleMarks.mockResolvedValueOnce({ marks: [] })

      await renderLoaded()

      expect(screen.queryByText(/^Checks for /)).not.toBeInTheDocument()
    })

    it('shows the error, with a way to try again, when loading fails', async () => {
      apiMock.getHoleMarks.mockRejectedValue(new ApiError('hole not found', 404))

      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load today’s checks: hole not found')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: CHECKLIST_NAME })).not.toBeInTheDocument()
    })

    it('tries again, and shows the checklist, when Try again is used', async () => {
      apiMock.getHoleMarks
        .mockRejectedValueOnce(new ApiError('could not fetch marks', 500))
        .mockResolvedValue(marksResponse([]))
      renderPage()
      await screen.findByRole('alert')

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

      expect(await screen.findByRole('region', { name: CHECKLIST_NAME })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(2)
    })
  })

  describe('showing the server’s marks', () => {
    it('shows who checked a task, and when', async () => {
      await renderLoaded({ marks: [YODAS_MOWING] })

      expect(box('Tee box: Mowed')).toBeChecked()
      expect(metaTexts()).toContain('Yoda · 5:48am')
    })

    it('says You for the person’s own check', async () => {
      await renderLoaded({ marks: [LUKES_ROUGH] })

      expect(metaTexts()).toContain('You · 6:12am')
    })

    it('shows a task set aside as not today, with an Undo button', async () => {
      await renderLoaded({ marks: [DINS_SPRAYING] })

      expect(metaTexts()).toContain('Not today')
      expect(box('Fairway: Fairway sprayed')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Undo: Fairway: Fairway sprayed' })).toBeInTheDocument()
    })

    it('counts the marks in the progress line', async () => {
      await renderLoaded({ marks: [YODAS_MOWING, LUKES_ROUGH, DINS_SPRAYING] })

      expect(screen.getByText('3 of 21 tasks accounted for')).toBeInTheDocument()
      expect(screen.getByText(/2 done · 1 not today\./)).toBeInTheDocument()
    })

    it('ignores a mark that matches nothing on the checklist', async () => {
      await renderLoaded({ marks: [makeServerMark('tee-box-mowed', { feature_id: 'feature-ghost' })] })

      expect(screen.getByText('0 of 21 tasks accounted for')).toBeInTheDocument()
    })
  })

  describe('tapping a task', () => {
    it('sends the task and its feature to the server, then shows what the server says', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([]))
        .mockResolvedValueOnce(marksResponse([LUKES_MOWING]))
      await renderLoaded()
      apiMock.setTaskMark.mockResolvedValue(LUKES_MOWING)

      await userEvent.click(box('Tee box: Mowed'))

      expect(await screen.findByText('You · 6:12am')).toBeInTheDocument()
      expect(apiMock.setTaskMark).toHaveBeenCalledWith('sample-tee_box', 'task-tee-box-mowed', 'done')
      expect(box('Tee box: Mowed')).toBeChecked()
      expect(screen.getByText('1 of 21 tasks accounted for')).toBeInTheDocument()
    })

    it('sets a task aside with the not_today status', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([]))
        .mockResolvedValueOnce(marksResponse([DINS_SPRAYING]))
      await renderLoaded()
      apiMock.setTaskMark.mockResolvedValue(DINS_SPRAYING)

      await userEvent.click(screen.getByRole('button', { name: 'Not today: Fairway: Fairway sprayed' }))

      expect(await screen.findByRole('button', { name: 'Undo: Fairway: Fairway sprayed' })).toBeInTheDocument()
      expect(apiMock.setTaskMark).toHaveBeenCalledWith('sample-fairway', 'task-fairway-sprayed', 'not_today')
    })

    it('takes a check back, and shows the task open again', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([LUKES_MOWING]))
        .mockResolvedValueOnce(marksResponse([]))
      await renderLoaded()
      expect(box('Tee box: Mowed')).toBeChecked()
      apiMock.clearTaskMark.mockResolvedValue(null)

      await userEvent.click(box('Tee box: Mowed'))

      await waitFor(() => expect(box('Tee box: Mowed')).not.toBeChecked())
      expect(apiMock.clearTaskMark).toHaveBeenCalledWith('sample-tee_box', 'task-tee-box-mowed')
    })

    it('takes back a task set aside from its Undo button', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([DINS_SPRAYING]))
        .mockResolvedValueOnce(marksResponse([]))
      await renderLoaded()
      apiMock.clearTaskMark.mockResolvedValue(null)

      await userEvent.click(screen.getByRole('button', { name: 'Undo: Fairway: Fairway sprayed' }))

      await waitFor(() => expect(box('Fairway: Fairway sprayed')).toBeEnabled())
      expect(apiMock.clearTaskMark).toHaveBeenCalledWith('sample-fairway', 'task-fairway-sprayed')
    })

    it('marks a bunker’s task on that bunker’s own feature', async () => {
      await renderLoaded()
      apiMock.setTaskMark.mockResolvedValue(LUKES_MOWING)

      await userEvent.click(box('Bunkers, Bunker 2: Raked by machine'))

      await waitFor(() => expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(2))
      expect(apiMock.setTaskMark).toHaveBeenCalledWith('sample-bunker-2', 'task-bunker-raked-machine', 'done')
    })

    it('lets an admin check a greenskeeper task', async () => {
      await renderLoaded({ user: MON_MOTHMA })
      apiMock.setTaskMark.mockResolvedValue(LUKES_MOWING)

      await userEvent.click(box('Tee box: Collect garbage'))

      await waitFor(() => expect(apiMock.getHoleMarks).toHaveBeenCalledTimes(2))
      expect(apiMock.setTaskMark).toHaveBeenCalledWith('sample-tee_box', 'task-collect-garbage', 'done')
    })

    it('sends nothing for a task the person may not check', async () => {
      await renderLoaded()

      await userEvent.click(box('Tee box: Collect garbage'))

      expect(apiMock.setTaskMark).not.toHaveBeenCalled()
      expect(apiMock.clearTaskMark).not.toHaveBeenCalled()
    })

    it('shows Saving… on the row, and nothing else changes, until the server has answered', async () => {
      await renderLoaded()
      const save = createDeferred()
      apiMock.setTaskMark.mockReturnValue(save.promise)

      await userEvent.click(box('Tee box: Mowed'))

      expect(await screen.findByText(SAVING_TEXT)).toBeInTheDocument()
      expect(box('Tee box: Mowed')).toBeDisabled()
      expect(box('Rough: Rough mowed')).toBeEnabled()
      expect(screen.getByRole('region', { name: CHECKLIST_NAME })).toBeInTheDocument()

      await act(async () => {
        save.resolve(LUKES_MOWING)
      })
      await waitFor(() => expect(screen.queryByText(SAVING_TEXT)).not.toBeInTheDocument())
    })
  })

  describe('when something goes wrong', () => {
    it('names who got there first, on that row, and shows their check', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([]))
        .mockResolvedValueOnce(marksResponse([YODAS_MOWING]))
      await renderLoaded()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('already marked, undo it first', 409))

      await userEvent.click(box('Tee box: Mowed'))

      expect(await within(rowOf('Tee box: Mowed')).findByRole('alert')).toHaveTextContent(
        'Yoda already marked this'
      )
      expect(metaTexts()).toContain('Yoda · 5:48am')
      expect(box('Tee box: Mowed')).toBeChecked()
      expect(screen.getAllByRole('alert')).toHaveLength(1)
    })

    it('says so when the person may not check the task', async () => {
      await renderLoaded()
      apiMock.setTaskMark.mockRejectedValue(new ApiError('you are not allowed to check this task', 403))

      await userEvent.click(box('Tee box: Mowed'))

      expect(await within(rowOf('Tee box: Mowed')).findByRole('alert')).toHaveTextContent(
        'You can’t check this task'
      )
    })

    it('says so when the save fails, and leaves the task as it was', async () => {
      await renderLoaded()
      apiMock.setTaskMark.mockRejectedValue(new TypeError('Failed to fetch'))

      await userEvent.click(box('Tee box: Mowed'))

      expect(await within(rowOf('Tee box: Mowed')).findByRole('alert')).toHaveTextContent(
        'Couldn’t save. Try again.'
      )
      expect(box('Tee box: Mowed')).not.toBeChecked()
      expect(box('Tee box: Mowed')).toBeEnabled()
    })

    it('takes the message away when it is dismissed', async () => {
      await renderLoaded()
      apiMock.setTaskMark.mockRejectedValue(new TypeError('Failed to fetch'))
      await userEvent.click(box('Tee box: Mowed'))
      await screen.findByRole('alert')

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss message: Tee box: Mowed' }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('keeps the checks on screen, and says so, when a save worked but the reload failed', async () => {
      apiMock.getHoleMarks
        .mockResolvedValueOnce(marksResponse([YODAS_MOWING]))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await renderLoaded()
      apiMock.setTaskMark.mockResolvedValue(LUKES_ROUGH)

      await userEvent.click(box('Rough: Rough mowed'))

      expect(await within(rowOf('Rough: Rough mowed')).findByRole('alert')).toHaveTextContent(STALE_LIST_TEXT)
      expect(metaTexts()).toContain('Yoda · 5:48am')
      expect(screen.getByRole('region', { name: CHECKLIST_NAME })).toBeInTheDocument()
    })
  })

  describe('who is responsible', () => {
    it('shows the list, with a note that the people are samples', async () => {
      await renderLoaded()

      expect(screen.getByRole('region', { name: RESPONSIBLE_NAME })).toBeInTheDocument()
      expect(screen.getByText(SAMPLE_NOTE)).toBeInTheDocument()
    })

    it('shows the list and the note while the marks are still loading', () => {
      apiMock.getHoleMarks.mockReturnValue(createDeferred().promise)

      renderPage()

      expect(screen.getByRole('region', { name: RESPONSIBLE_NAME })).toBeInTheDocument()
      expect(screen.getByText(SAMPLE_NOTE)).toBeInTheDocument()
    })

    it('shows neither the list nor the note, and says there are no tasks, for a hole with no features', async () => {
      apiMock.getHoleMarks.mockResolvedValue(marksResponse([]))

      renderPage({ features: [] })

      expect(await screen.findByText(NO_TASKS_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: RESPONSIBLE_NAME })).not.toBeInTheDocument()
      expect(screen.queryByText(SAMPLE_NOTE)).not.toBeInTheDocument()
    })
  })
})