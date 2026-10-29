const RANGE_DASH = '–'

// How a hole is named on screen. A club with several courses uses the course's letter
// ("C7"); a course with no letter uses its name; a club with one course says "Hole 7".
export function formatHoleLabel(layout, hole, layoutCount) {
  if (layoutCount <= 1) {
    return `Hole ${hole.hole_number}`
  }
  if (layout.code) {
    return `${layout.code}${hole.hole_number}`
  }
  return `${layout.name} ${hole.hole_number}`
}

// "C1–C5" for a coded course in a multi-course club, "1–9" otherwise (the heading above
// already names the course). One hole is just its number.
export function formatHoleRange(layout, holes, layoutCount) {
  if (holes.length === 0) {
    return ''
  }

  const prefix = layoutCount > 1 && layout.code ? layout.code : ''
  const firstNumber = holes[0].hole_number
  const lastNumber = holes[holes.length - 1].hole_number

  return firstNumber === lastNumber
    ? `${prefix}${firstNumber}`
    : `${prefix}${firstNumber}${RANGE_DASH}${prefix}${lastNumber}`
}

// Splits a course into its front and back holes, using the front count stored on the course.
// A course with no usable front count, or one that would leave a side empty, isn't split.
// Holes keep the order they arrive in.
export function splitFrontBack(layout) {
  const holes = layout.holes ?? []
  const frontCount = layout.front_hole_count

  if (typeof frontCount !== 'number') {
    return [{ key: 'all', holes }]
  }

  const front = holes.filter((hole) => hole.hole_number <= frontCount)
  const back = holes.filter((hole) => hole.hole_number > frontCount)

  if (front.length === 0 || back.length === 0) {
    return [{ key: 'all', holes }]
  }

  return [
    { key: 'front', holes: front },
    { key: 'back', holes: back },
  ]
}

// "Front C" for a coded course in a multi-course club, "Front" otherwise. A course that
// isn't split has no group title.
export function formatGroupTitle(layout, groupKey, layoutCount) {
  if (groupKey === 'all') {
    return null
  }

  const base = groupKey === 'front' ? 'Front' : 'Back'
  return layoutCount > 1 && layout.code ? `${base} ${layout.code}` : base
}

// Which amenities sit on each hole, keyed by hole id, in the order the amenities arrive.
// Amenities with no hole (a clubhouse, a driving range) are left out.
export function groupAmenitiesByHole(amenities) {
  const amenitiesByHole = new Map()

  for (const amenity of amenities ?? []) {
    if (!amenity.hole_id) {
      continue
    }
    if (!amenitiesByHole.has(amenity.hole_id)) {
      amenitiesByHole.set(amenity.hole_id, [])
    }
    amenitiesByHole.get(amenity.hole_id).push(amenity)
  }

  return amenitiesByHole
}

// Every hole's label by hole id, so an amenity can say which hole it is on
export function buildHoleLabels(layouts) {
  const labels = new Map()

  for (const layout of layouts) {
    for (const hole of layout.holes ?? []) {
      labels.set(hole.id, formatHoleLabel(layout, hole, layouts.length))
    }
  }

  return labels
}