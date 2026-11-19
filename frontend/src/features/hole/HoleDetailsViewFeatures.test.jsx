import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { holeIdOf } from '../../test/fixtures/course'
import { CHECKLIST_NAME } from '../../test/fixtures/holeChecklistCases'
import {
  BUNKER_PAGE,
  BUNKER_PAGE_CASES,
  NO_FEATURES_HOLE_ID,
  NO_FEATURES_PAGE,
} from '../../test/fixtures/holeFeatureCases'
import { SAMPLE_TASK_LIST } from '../../test/fixtures/holeTaskCases'
import { LUKE } from '../../test/fixtures/taskPermissionCases'
import { HoleDetailsView } from './HoleDetailsView'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn(), getHoleTasks: vi.fn(), getHoleMarks: vi.fn() },
  useAuthMock: vi.fn(),
}))

// The real ApiError and isClockInRequired stay, and only the calls to the server are replaced
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: apiMock,
}))
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }))

const BACK_LINK_NAME = '← Course'
const NO_TASKS_TEXT = 'There are no tasks for this hole today.'
const CLUB_DATE = '2026-11-17'

// Luke's check on the tee box mowing of hole K3, as the server sends it. The feature id is the one
// the test course gives that hole's tee box.
const LUKES_MOWING_ON_K3 = {
  feature_id: `${holeIdOf('K', 3)}-tee_box`,
  task_id: 'task-tee-box-mowed',
  status: 'done',
  user_id: 'user-luke',
  user_name: 'Luke Skywalker',
  marked_at: new Date(2026, 10, 17, 6, 12).toISOString(),
}

// Actions
// A page for one hole, with a link beside it to another hole of the same course, so a test can
// move between holes the way a person would
function renderPage(holeId, nextHoleId) {
  return render(
    <MemoryRouter initialEntries={ [`/course/holes/${holeId}`] }>
      <Routes>
        <Route
          path="/course/holes/:holeId"
          element={
            <>
              { nextHoleId && <Link to={ `/course/holes/${nextHoleId}` }>Next hole</Link> }
              <HoleDetailsView />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoadedPage(course, holeId, nextHoleId) {
  apiMock.getCourse.mockResolvedValue(course)
  renderPage(holeId, nextHoleId)
  await screen.findByRole('link', { name: BACK_LINK_NAME })
  // Let the marks request, which starts once a hole is shown, finish
  await act(async () => {})
}

function headingTexts(level) {
  return screen.queryAllByRole('heading', { level }).map((heading) => heading.textContent)
}

function bunkerSections() {
  return headingTexts(5).filter((text) => text.startsWith('Bunker '))
}

describe('the checklist on the hole page', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
    apiMock.getHoleTasks.mockReset()
    apiMock.getHoleTasks.mockResolvedValue(SAMPLE_TASK_LIST)
    apiMock.getHoleMarks.mockReset()
    apiMock.getHoleMarks.mockImplementation(async (holeId) => ({
      date: CLUB_DATE,
      marks: holeId === holeIdOf('K', 3) ? [LUKES_MOWING_ON_K3] : [],
    }))
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ user: LUKE })
  })

  it.each(BUNKER_PAGE_CASES)('shows a section for each bunker on $name', async ({ holeId, bunkers }) => {
    await renderLoadedPage(BUNKER_PAGE, holeId)
    await screen.findByRole('region', { name: CHECKLIST_NAME })

    expect(bunkerSections()).toEqual(Array.from({ length: bunkers }, (unusedItem, index) => `Bunker ${index + 1}`))
    expect(headingTexts(4).includes('Bunkers')).toBe(bunkers > 0)
  })

  it('shows an empty checklist, and no list of who is responsible, for a hole with no features', async () => {
    await renderLoadedPage(NO_FEATURES_PAGE, NO_FEATURES_HOLE_ID)

    expect(await screen.findByText(NO_TASKS_TEXT)).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('region', { name: 'Responsible today' })).not.toBeInTheDocument()
  })

  it("shows each hole's own checks, and its own bunkers, as the person moves between holes", async () => {
    await renderLoadedPage(BUNKER_PAGE, holeIdOf('K', 3), holeIdOf('K', 4))
    expect(await screen.findByRole('checkbox', { name: 'Tee box: Mowed' })).toBeChecked()
    expect(bunkerSections()).toHaveLength(3)

    await userEvent.click(screen.getByRole('link', { name: 'Next hole' }))

    await waitFor(() => expect(bunkerSections()).toHaveLength(5))
    expect(screen.getByRole('checkbox', { name: 'Tee box: Mowed' })).not.toBeChecked()
    expect(apiMock.getHoleMarks.mock.calls.map(([holeId]) => holeId)).toEqual([holeIdOf('K', 3), holeIdOf('K', 4)])
  })
})