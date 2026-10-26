import { describe, expect, it } from 'vitest'
import { LANDING_PATH, NAV_ITEMS, findNavItem } from './navItems'

// Test data
const ALLOWED_WIDTHS = ['full', 'reading']

// Ways a browser might spell the path of a page the router would still send there
const SPELLING_CASES = [
  { label: 'upper case', transform: (path) => path.toUpperCase() },
  { label: 'a capital first letter', transform: (path) => `/${path[1].toUpperCase()}${path.slice(2)}` },
  { label: 'a trailing slash', transform: (path) => `${path}/` },
  { label: 'a sub-page', transform: (path) => `${path}/anything` },
]

const NOT_PAGES = [
  { label: 'the site root', pathname: '/' },
  { label: 'the login page', pathname: '/login' },
  { label: 'an unknown page', pathname: '/unknown' },
  { label: 'a path that only starts like a page', pathname: '/schedulefoo' },
  { label: 'a longer word containing a page name', pathname: '/clocks' },
  { label: 'an empty path', pathname: '' },
]

describe('NAV_ITEMS', () => {
  it.each(NAV_ITEMS)('describes $label completely', (item) => {
    expect(item.path).toMatch(/^\/[a-z-]+$/)
    expect(item.label.trim()).not.toBe('')
    expect(item.title.trim()).not.toBe('')
    expect(item.icon.trim()).not.toBe('')
    expect(ALLOWED_WIDTHS).toContain(item.width)
  })

  it('has a different path for every item', () => {
    const paths = NAV_ITEMS.map((item) => item.path)

    expect(new Set(paths).size).toBe(paths.length)
  })

  it('has a different label for every item', () => {
    const labels = NAV_ITEMS.map((item) => item.label)

    expect(new Set(labels).size).toBe(labels.length)
  })

  it('has no path nested inside another, which would make lookups ambiguous', () => {
    for (const item of NAV_ITEMS) {
      for (const other of NAV_ITEMS) {
        if (item !== other) {
          expect(
            other.path.startsWith(`${item.path}/`),
            `${other.path} sits inside ${item.path}`
          ).toBe(false)
        }
      }
    }
  })

  it('lands on a page that exists', () => {
    expect(NAV_ITEMS.map((item) => item.path)).toContain(LANDING_PATH)
  })
})

describe('findNavItem', () => {
  it.each(NAV_ITEMS)('finds $label by its exact path', (item) => {
    expect(findNavItem(item.path)).toBe(item)
  })

  describe.each(SPELLING_CASES)('with $label', ({ transform }) => {
    it.each(NAV_ITEMS)('still finds $label', (item) => {
      expect(findNavItem(transform(item.path))).toBe(item)
    })
  })

  it.each(NOT_PAGES)('finds nothing for $label', ({ pathname }) => {
    expect(findNavItem(pathname)).toBeUndefined()
  })
})