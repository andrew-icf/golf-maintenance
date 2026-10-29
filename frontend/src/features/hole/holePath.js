const HOLES_BASE_PATH = '/course/holes'

// The route the hole details page is registered under. Keeping it next to holePath means the
// links and the route can't drift apart.
export const HOLE_ROUTE_PATTERN = `${HOLES_BASE_PATH}/:holeId`

// The address of one hole's details page. The id is encoded, so an id with a slash or a
// question mark in it can't break the address.
export function holePath(holeId) {
  return `${HOLES_BASE_PATH}/${encodeURIComponent(holeId)}`
}