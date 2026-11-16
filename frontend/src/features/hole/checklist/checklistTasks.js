import { lookupLabel } from '../../../constants/lookupLabel'

// The areas of a hole the page groups tasks under, in the order it lists them
export const FEATURE_ORDER = ['tee_box', 'fairway', 'approach', 'rough', 'bunker', 'green']

const FEATURE_TITLES = {
  tee_box: 'Tee box',
  fairway: 'Fairway',
  approach: 'Approach',
  rough: 'Rough',
  bunker: 'Bunkers',
  green: 'Green',
  other: 'Other',
}

// How many bunkers the sample hole has
export const SAMPLE_BUNKER_COUNT = 3

// The kinds of feature every hole has exactly one of, as the server lists them. A hole also has
// numbered bunkers, and only bunkers repeat.
const STANDARD_FEATURE_TYPES = ['tee_box', 'par_3_tee_box', 'fairway', 'approach', 'rough', 'green']
const REPEATING_FEATURE_TYPES = ['bunker']

// The area of the page each kind of feature is shown under. The tee box and the par 3 tee box
// share one, and a kind the page does not know goes under Other.
const AREA_BY_FEATURE_TYPE = {
  tee_box: 'tee_box',
  par_3_tee_box: 'tee_box',
  fairway: 'fairway',
  approach: 'approach',
  rough: 'rough',
  green: 'green',
  bunker: 'bunker',
}

// A tee box and a par 3 tee box each get a section of their own, the regular one first
const SECTION_BY_FEATURE_TYPE = {
  tee_box: { key: 'tee-box', title: 'Tee box', order: 1 },
  par_3_tee_box: { key: 'par-3-tee-box', title: 'Par 3 tee box', order: 2 },
}

export function formatFeatureTitle(feature) {
  return lookupLabel(FEATURE_TITLES, feature)
}

// The features of a hole like the sample one: the standard six, then this many bunkers numbered
// from one. A count that is not a whole number above zero counts as no bunkers.
export function buildSampleFeatures(bunkerCount = SAMPLE_BUNKER_COUNT) {
  const bunkers = Number.isInteger(bunkerCount) && bunkerCount > 0 ? bunkerCount : 0

  return [
    ...STANDARD_FEATURE_TYPES.map((type) => ({ id: `sample-${type}`, type, position: 1 })),
    ...Array.from({ length: bunkers }, (unusedItem, index) => ({
      id: `sample-bunker-${index + 1}`,
      type: 'bunker',
      position: index + 1,
    })),
  ]
}

function isNonBlankText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

// A task is only usable when it says what it is called, what it is for, and what to call it
function isUsableTask(task) {
  return (
    task !== null &&
    typeof task === 'object' &&
    isNonBlankText(task.code) &&
    isNonBlankText(task.feature_type) &&
    isNonBlankText(task.name)
  )
}

function hasCode(duty) {
  return duty !== null && typeof duty === 'object' && isNonBlankText(duty.code)
}

function areaOf(featureType) {
  return Object.hasOwn(AREA_BY_FEATURE_TYPE, featureType) ? AREA_BY_FEATURE_TYPE[featureType] : 'other'
}

// The section a task sits in, which follows from the feature it is for: a bunker's own number, or
// the tee box or par 3 tee box. Everything else has none.
function sectionFor(featureType, position) {
  if (featureType === 'bunker') {
    return { key: `bunker-${position}`, title: `Bunker ${position}`, order: position }
  }
  return Object.hasOwn(SECTION_BY_FEATURE_TYPE, featureType) ? { ...SECTION_BY_FEATURE_TYPE[featureType] } : null
}

// For each kind of feature, the positions the hole has it at. A feature that does not repeat is at
// position 1 however many times it is listed, and a bunker is only counted when its position is a
// whole number above zero. Entries that are not features are left out.
function indexFeatures(features) {
  if (!Array.isArray(features)) {
    return new Map()
  }

  const positionSets = new Map()
  for (const feature of features) {
    if (!feature || typeof feature !== 'object' || typeof feature.type !== 'string') {
      continue
    }

    const repeats = REPEATING_FEATURE_TYPES.includes(feature.type)
    if (repeats && !(Number.isInteger(feature.position) && feature.position >= 1)) {
      continue
    }

    if (!positionSets.has(feature.type)) {
      positionSets.set(feature.type, new Set())
    }
    positionSets.get(feature.type).add(repeats ? feature.position : 1)
  }

  return new Map(
    [...positionSets].map(([type, positions]) => [type, [...positions].sort((first, second) => first - second)])
  )
}

function makeItem(task, dutyCodeById, position) {
  const repeats = REPEATING_FEATURE_TYPES.includes(task.feature_type)

  return {
    id: repeats ? `${task.code}:${position}` : task.code,
    templateId: task.code,
    feature: areaOf(task.feature_type),
    name: task.name,
    allowedJobTitles: Array.isArray(task.allowed_job_titles) ? [...task.allowed_job_titles] : [],
    duty: dutyCodeById.get(task.duty_id) ?? null,
    section: sectionFor(task.feature_type, position),
  }
}

// The tasks on one hole's checklist: the club's task list, from the server, matched against the
// features the hole has. A hole has the tasks of the features it has and none for the features it
// lacks, and a task for a feature that repeats, a bunker, is made once for each one. Tasks keep the
// order the list gives them. Anything that is not a list of features or a task list builds nothing.
export function buildChecklistItems(features, taskList) {
  const tasks = Array.isArray(taskList?.tasks) ? taskList.tasks : []
  const duties = Array.isArray(taskList?.duties) ? taskList.duties : []
  const dutyCodeById = new Map(
    duties.filter((duty) => hasCode(duty) && typeof duty.id === 'string').map((duty) => [duty.id, duty.code])
  )
  const positionsByType = indexFeatures(features)
  const items = []

  for (const task of tasks) {
    if (!isUsableTask(task)) {
      continue
    }

    const positions = positionsByType.get(task.feature_type) ?? []
    if (REPEATING_FEATURE_TYPES.includes(task.feature_type)) {
      for (const position of positions) {
        items.push(makeItem(task, dutyCodeById, position))
      }
    } else if (positions.length > 0) {
      items.push(makeItem(task, dutyCodeById, 1))
    }
  }

  return items
}

// A task belongs to a section only when it names one with a key
function sectionOf(item) {
  const section = item.section

  if (section && typeof section === 'object' && typeof section.key === 'string' && section.key !== '') {
    return section
  }
  return null
}

function compareOrder(first, second) {
  if (first === second) {
    return 0
  }
  return first < second ? -1 : 1
}

// Within an area, tasks with no section come first, then each section by its order. Sections with
// no order follow the ones that have one, in the order they arrived, and a task keeps its place
// within its section.
function buildSections(featureItems) {
  const unsectioned = featureItems.filter((item) => !sectionOf(item))
  const sectionsByKey = new Map()

  for (const item of featureItems) {
    const section = sectionOf(item)
    if (!section) {
      continue
    }
    if (!sectionsByKey.has(section.key)) {
      sectionsByKey.set(section.key, {
        key: section.key,
        title: typeof section.title === 'string' && section.title ? section.title : null,
        order: Number.isFinite(section.order) ? section.order : Infinity,
        items: [],
      })
    }
    sectionsByKey.get(section.key).items.push(item)
  }

  const sections = [...sectionsByKey.values()]
    .sort((first, second) => compareOrder(first.order, second.order))
    .map(({ key, title, items }) => ({ key, title, items }))

  return unsectioned.length > 0 ? [{ key: 'all', title: null, items: unsectioned }, ...sections] : sections
}

// The checklist as the page shows it: areas in order, each with its sections of tasks. An area
// with no tasks is left out. An area the page does not know follows the known ones under its own
// name, and tasks with no area come last, under "Other".
export function groupChecklist(items) {
  const itemsByFeature = new Map()

  for (const item of items ?? []) {
    const feature = typeof item.feature === 'string' && item.feature ? item.feature : 'other'
    if (!itemsByFeature.has(feature)) {
      itemsByFeature.set(feature, [])
    }
    itemsByFeature.get(feature).push(item)
  }

  const knownFeatures = FEATURE_ORDER.filter((feature) => itemsByFeature.has(feature))
  const otherFeatures = [...itemsByFeature.keys()].filter((feature) => !FEATURE_ORDER.includes(feature))
  // "Other" is always last, even after an area the page does not know
  const orderedOtherFeatures = [
    ...otherFeatures.filter((feature) => feature !== 'other'),
    ...otherFeatures.filter((feature) => feature === 'other'),
  ]

  return [...knownFeatures, ...orderedOtherFeatures].map((feature) => ({
    key: feature,
    title: formatFeatureTitle(feature),
    sections: buildSections(itemsByFeature.get(feature)),
  }))
}

// The duties the tasks belong to, for the "Responsible today" list. The duties come from the club's
// task list, in the order it gives them, each titled with its name (or its code when it has none).
// A duty a task has that the list does not know follows them, titled with its code. A duty is
// listed once, and tasks with no duty are skipped.
export function listDuties(items, duties) {
  const present = new Set()
  for (const item of items ?? []) {
    if (typeof item.duty === 'string' && item.duty) {
      present.add(item.duty)
    }
  }

  const entries = []
  const listedCodes = new Set()
  for (const duty of Array.isArray(duties) ? duties : []) {
    if (!hasCode(duty) || !present.has(duty.code) || listedCodes.has(duty.code)) {
      continue
    }
    listedCodes.add(duty.code)
    entries.push({ key: duty.code, title: isNonBlankText(duty.name) ? duty.name : duty.code })
  }

  for (const code of present) {
    if (!listedCodes.has(code)) {
      entries.push({ key: code, title: code })
    }
  }

  return entries
}