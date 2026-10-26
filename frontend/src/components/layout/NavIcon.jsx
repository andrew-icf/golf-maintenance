const ICON_SHAPES = {
  schedule: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  course: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  equipment: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}

export function NavIcon({ name, size = 20 }) {
  // hasOwn, so a name like "constructor" can't pick up something every object inherits
  const shapes = Object.hasOwn(ICON_SHAPES, name) ? ICON_SHAPES[name] : null

  if (!shapes) {
    return null
  }

  return (
    <svg
      width={ size }
      height={ size }
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      { shapes }
    </svg>
  )
}