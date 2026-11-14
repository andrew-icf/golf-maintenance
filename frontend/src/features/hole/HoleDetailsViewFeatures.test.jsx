import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { holeIdOf } from '../../test/fixtures/course'
import {
  BUNKER_PAGE,
  BUNKER_PAGE_CASES,
  NO_FEATURES_HOLE_ID,
  NO_FEATURES_PAGE,
} from '../../test/fixtures/holeFeatureCases'
import { LUKE } from '../../test/fixtures/taskPermissionCases'
import { HoleDetailsView } from './HoleDetailsView'

const { apiMock, useAuthMock } = vi.hoisted(() => ({
  apiMock: { getCourse: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock('../../api', () => ({ api: apiMock }))
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }))

const BACK_LINK_NAME = '← Course'
const NO_TASKS_TEXT = 'There are no tasks for this hole today.'

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
}

function headingTexts(level) {
  return screen.queryAllByRole('heading', { level }).map((heading) => heading.textContent)
}

describe('the checklist on the hole page', () => {
  beforeEach(() => {
    apiMock.getCourse.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ user: LUKE })
  })

  it.each(BUNKER_PAGE_CASES)('shows a section for each bunker on $name', async ({ holeId, bunkers }) => {
    await renderLoadedPage(BUNKER_PAGE, holeId)

    const bunkerSections = headingTexts(5).filter((text) => text.startsWith('Bunker '))

    expect(bunkerSections).toEqual(Array.from({ length: bunkers }, (unusedItem, index) => `Bunker ${index + 1}`))
    expect(headingTexts(4).includes('Bunkers')).toBe(bunkers > 0)
  })

  it('shows an empty checklist, and no list of who is responsible, for a hole with no features', async () => {
    await renderLoadedPage(NO_FEATURES_PAGE, NO_FEATURES_HOLE_ID)

    expect(screen.getByText(NO_TASKS_TEXT)).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('region', { name: 'Responsible today' })).not.toBeInTheDocument()
  })

  it("does not carry a check from one hole to the next, and follows the next hole's own features", async () => {
    await renderLoadedPage(BUNKER_PAGE, holeIdOf('K', 3), holeIdOf('K', 4))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tee box: Mowed' }))
    expect(screen.getByRole('checkbox', { name: 'Tee box: Mowed' })).toBeChecked()
    expect(headingTexts(5).filter((text) => text.startsWith('Bunker '))).toHaveLength(3)

    await userEvent.click(screen.getByRole('link', { name: 'Next hole' }))

    expect(headingTexts(5).filter((text) => text.startsWith('Bunker '))).toHaveLength(5)
    expect(screen.getByRole('checkbox', { name: 'Tee box: Mowed' })).not.toBeChecked()
  })
})