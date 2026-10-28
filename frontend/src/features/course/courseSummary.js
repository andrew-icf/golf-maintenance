const YARDAGE_FORMAT = new Intl.NumberFormat('en-US')

// Everything the sidebar header needs, worked out from the /api/course response.
// It reads the holes inside each course, so nothing here assumes a set number of holes.
export function summarizeCourse(course) {
  const layouts = course?.layouts ?? []
  const holes = layouts.flatMap((layout) => layout.holes ?? [])
  const holesWithYardage = holes.filter((hole) => typeof hole.yardage === 'number')

  return {
    name: course?.name ?? '',
    layoutCount: layouts.length,
    holeCount: holes.length,
    totalYardage:
      holesWithYardage.length === 0
        ? null
        : holesWithYardage.reduce((total, hole) => total + hole.yardage, 0),
    holesMissingYardage: holes.length - holesWithYardage.length,
  }
}

export function formatHoleCount(holeCount) {
  return holeCount === 1 ? '1 hole' : `${holeCount} holes`
}

// "27 holes · 3 courses" for a club with several courses, just "18 holes" for one
export function formatCourseSize({ holeCount, layoutCount }) {
  const holes = formatHoleCount(holeCount)
  return layoutCount > 1 ? `${holes} · ${layoutCount} courses` : holes
}

export function formatYardage(totalYardage) {
  return totalYardage === null ? '—' : `${YARDAGE_FORMAT.format(totalYardage)} yds`
}