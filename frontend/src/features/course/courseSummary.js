const YARDAGE_FORMAT = new Intl.NumberFormat('en-US')

// Everything the sidebar header needs, worked out from the /api/course response.
export function summarizeCourse(course) {
  const holes = course?.holes ?? []
  const holesWithYardage = holes.filter((hole) => typeof hole.yardage === 'number')

  return {
    name: course?.name ?? '',
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

export function formatYardage(totalYardage) {
  return totalYardage === null ? '—' : `${YARDAGE_FORMAT.format(totalYardage)} yds`
}