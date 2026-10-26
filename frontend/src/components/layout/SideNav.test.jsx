import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SideNav } from './SideNav'
import { NAV_ITEMS } from './navItems'

// Test data
const APP_NAME = 'Golf Maintenance'
const TODAY = '2026-10-21'
const TODAY_TEXT = 'Wed, Oct 21'
const COURSE_NAME = 'Dagobah Pines Golf Club'
const TOTAL_YARDAGE_TEXT = '9,980 yds'

function makeCourse(overrides = {}) {
  return {
    name: COURSE_NAME,
    holeCount: 27,
    totalYardage: 9980,
    holesMissingYardage: 0,
    ...overrides,
  }
}

const APP_NAME_CASES = [
  { label: 'before the course has loaded', course: null },
  { label: 'once the course has loaded', course: makeCourse() },
]

const COURSE_DISPLAY_CASES = [
  { label: 'a 27-hole course', course: makeCourse(), holes: '27 holes', yardage: '9,980 yds' },
  {
    label: 'a nine-hole course',
    course: makeCourse({ holeCount: 9, totalYardage: 3320 }),
    holes: '9 holes',
    yardage: '3,320 yds',
  },
  {
    label: 'a single hole',
    course: makeCourse({ holeCount: 1, totalYardage: 150 }),
    holes: '1 hole',
    yardage: '150 yds',
  },
  {
    label: 'a course with no yardage entered',
    course: makeCourse({ totalYardage: null }),
    holes: '27 holes',
    yardage: '—',
  },
  {
    label: 'a course with no holes yet',
    course: makeCourse({ holeCount: 0, totalYardage: null }),
    holes: '0 holes',
    yardage: '—',
  },
]

const DATE_CASES = [
  { todayDate: '2026-10-21', expected: 'Wed, Oct 21' },
  { todayDate: '2027-01-01', expected: 'Fri, Jan 1' },
  { todayDate: '2028-02-29', expected: 'Tue, Feb 29' },
]

const MARKUP_NAME = '<b>Pines</b>'

// Paths that should highlight a page, including spellings the router also accepts
const CURRENT_PAGE_CASES = [
  { path: '/COURSE', label: 'Course' },
  { path: '/equipment/123', label: 'Equipment' },
  { path: '/Schedule/', label: 'Schedule' },
]

const NO_CURRENT_PAGE_CASES = [
  { label: 'the site root', path: '/' },
  { label: 'the login page', path: '/login' },
  { label: 'an unknown page', path: '/unknown' },
]

// Actions
function renderSideNav({ course = null, todayDate = TODAY, path = '/schedule' } = {}) {
  return render(
    <MemoryRouter initialEntries={ [path] }>
      <SideNav course={ course } todayDate={ todayDate } />
    </MemoryRouter>
  )
}

function navLinks() {
  return within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')
}

function linkNamed(label) {
  return screen.getByRole('link', { name: label })
}

describe('SideNav', () => {
  describe('header', () => {
    it.each(APP_NAME_CASES)('shows the app name $label', ({ course }) => {
      renderSideNav({ course })

      expect(screen.getByText(APP_NAME)).toBeInTheDocument()
    })

    it('shows only the app name until the course has loaded', () => {
      const { container } = renderSideNav({ course: null })

      expect(container.querySelector('.side-nav-course')).toBeNull()
      expect(screen.queryByText('Total yardage')).not.toBeInTheDocument()
      expect(screen.queryByText('Today')).not.toBeInTheDocument()
      expect(screen.queryByText(TODAY_TEXT)).not.toBeInTheDocument()
    })

    it.each(COURSE_DISPLAY_CASES)('shows the name, holes, and yardage for $label', ({ course, holes, yardage }) => {
      renderSideNav({ course })

      expect(screen.getByText(COURSE_NAME)).toBeInTheDocument()
      expect(screen.getByText(holes)).toBeInTheDocument()
      expect(screen.getByText(yardage)).toBeInTheDocument()
    })

    it.each(DATE_CASES)("shows $todayDate as '$expected'", ({ todayDate, expected }) => {
      renderSideNav({ course: makeCourse(), todayDate })

      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it('shows the course name as text, never as markup', () => {
      const { container } = renderSideNav({ course: makeCourse({ name: MARKUP_NAME }) })

      expect(screen.getByText(MARKUP_NAME)).toBeInTheDocument()
      expect(container.querySelector('b')).toBeNull()
    })

    it('pairs each fact with its label', () => {
      renderSideNav({ course: makeCourse() })

      expect(screen.getByText('Total yardage').closest('div')).toHaveTextContent(TOTAL_YARDAGE_TEXT)
      expect(screen.getByText('Today').closest('div')).toHaveTextContent(TODAY_TEXT)
    })
  })

  describe('navigation', () => {
    it('is a navigation landmark named Main', () => {
      renderSideNav()

      expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    })

    it('lists every page in order, each linking to its path', () => {
      renderSideNav()

      const links = navLinks()

      expect(links.map((link) => link.textContent)).toEqual(NAV_ITEMS.map((item) => item.label))
      expect(links.map((link) => link.getAttribute('href'))).toEqual(NAV_ITEMS.map((item) => item.path))
    })

    it('draws a hidden icon beside every label', () => {
      renderSideNav()

      for (const link of navLinks()) {
        expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      }
    })

    it('still shows every link before the course has loaded', () => {
      renderSideNav({ course: null })

      expect(navLinks()).toHaveLength(NAV_ITEMS.length)
    })

    it.each(NAV_ITEMS)('marks $label as the current page at its own path, and no other', (item) => {
      renderSideNav({ path: item.path })

      for (const link of navLinks()) {
        if (link.textContent === item.label) {
          expect(link).toHaveAttribute('aria-current', 'page')
          expect(link).toHaveClass('active')
        } else {
          expect(link).not.toHaveAttribute('aria-current')
          expect(link).not.toHaveClass('active')
        }
      }
    })

    it.each(CURRENT_PAGE_CASES)('marks $label as current at $path', ({ path, label }) => {
      renderSideNav({ path })

      expect(linkNamed(label)).toHaveAttribute('aria-current', 'page')
    })

    it.each(NO_CURRENT_PAGE_CASES)('marks no page as current at $label', ({ path }) => {
      renderSideNav({ path })

      for (const link of navLinks()) {
        expect(link).not.toHaveAttribute('aria-current')
      }
    })
  })
})