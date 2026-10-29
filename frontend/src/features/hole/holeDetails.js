import {
  formatGroupTitle,
  formatHoleLabel,
  groupAmenitiesByHole,
  splitFrontBack,
} from '../course/courseLayout'

function buildDetails(course, layout, hole, layoutCount) {
  const group = splitFrontBack(layout).find((holeGroup) =>
    holeGroup.holes.some((holeInGroup) => holeInGroup.id === hole.id)
  )

  return {
    id: hole.id,
    label: formatHoleLabel(layout, hole, layoutCount),
    courseName: layoutCount > 1 ? layout.name : null,
    groupTitle: formatGroupTitle(layout, group.key, layoutCount),
    par: hole.par,
    yardage: typeof hole.yardage === 'number' ? hole.yardage : null,
    amenities: groupAmenitiesByHole(course.amenities).get(hole.id) ?? [],
  }
}

// Everything the hole details page shows about one hole, looked up in the /api/course
// response by the hole's id. Returns null when the course has no such hole. It reads the
// holes inside the courses, never the old flat list the server also sends.
export function findHoleDetails(course, holeId) {
  if (!holeId) {
    return null
  }

  const layouts = course?.layouts ?? []

  for (const layout of layouts) {
    const hole = (layout.holes ?? []).find((layoutHole) => layoutHole.id === holeId)

    if (hole) {
      return buildDetails(course, layout, hole, layouts.length)
    }
  }

  return null
}