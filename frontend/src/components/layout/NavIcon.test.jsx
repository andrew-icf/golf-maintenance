import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'

// Test data
const SHAPE_SELECTOR = 'path, rect, circle'
const DEFAULT_SIZE = '20'
const CUSTOM_SIZE = 32

const UNKNOWN_ICON_CASES = [
  { label: 'a name that does not exist', name: 'bogus' },
  { label: 'an empty name', name: '' },
  { label: 'no name', name: undefined },
  { label: 'a name every object inherits', name: 'constructor' },
]

// Actions
function renderIcon(props) {
  const { container } = render(<NavIcon { ...props } />)
  return container.querySelector('svg')
}

describe('NavIcon', () => {
  it.each(NAV_ITEMS)('draws the icon configured for $label', (item) => {
    const icon = renderIcon({ name: item.icon })

    expect(icon).not.toBeNull()
    expect(icon.querySelectorAll(SHAPE_SELECTOR).length).toBeGreaterThan(0)
    // Hidden from screen readers (the link text names the page) and tinted by the link's color
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('stroke', 'currentColor')
  })

  it.each(UNKNOWN_ICON_CASES)('draws nothing for $label', ({ name }) => {
    expect(renderIcon({ name })).toBeNull()
  })

  it('is 20 pixels square by default', () => {
    const icon = renderIcon({ name: NAV_ITEMS[0].icon })

    expect(icon).toHaveAttribute('width', DEFAULT_SIZE)
    expect(icon).toHaveAttribute('height', DEFAULT_SIZE)
  })

  it('uses the size it is given', () => {
    const icon = renderIcon({ name: NAV_ITEMS[0].icon, size: CUSTOM_SIZE })

    expect(icon).toHaveAttribute('width', String(CUSTOM_SIZE))
    expect(icon).toHaveAttribute('height', String(CUSTOM_SIZE))
  })
})