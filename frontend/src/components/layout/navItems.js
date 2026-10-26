// Where everyone lands after logging in
export const LANDING_PATH = '/course'

// Every page in the side nav. `width` is how much of the screen the page's content may use:
// 'full' fills the available space, 'reading' stays at a comfortable line length.
export const NAV_ITEMS = [
  { path: '/schedule', label: 'Schedule', title: 'Schedule', icon: 'schedule', width: 'full' },
  { path: '/course', label: 'Course', title: 'Course', icon: 'course', width: 'reading' },
  { path: '/equipment', label: 'Equipment', title: 'Equipment', icon: 'equipment', width: 'reading' },
  { path: '/clock', label: 'Clock', title: 'Clock', icon: 'clock', width: 'reading' },
]

// Finds the nav item for the page being shown, given the URL's path.
// The router matches paths without regard to case, so this does too.
export function findNavItem(pathname) {
  const normalizedPath = pathname.toLowerCase()

  return NAV_ITEMS.find(
    (item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`)
  )
}