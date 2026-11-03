import { lookupLabel } from '../../../constants/lookupLabel'

const GREENSKEEPER = ['greenskeeper']
const OPERATOR = ['operator']

// The areas of a hole a task belongs to, in the order the page lists them
export const FEATURE_ORDER = ['tee_box', 'fairway', 'rough', 'bunker', 'green']

const FEATURE_TITLES = {
  tee_box: 'Tee box',
  fairway: 'Fairway',
  rough: 'Rough',
  bunker: 'Bunkers',
  green: 'Green',
  other: 'Other',
}

// Who is answerable for a task, in the order the "Responsible today" list shows them
export const DUTY_ORDER = [
  'greenskeeper',
  'bunkers',
  'greens',
  'rolling',
  'spraying',
  'rough',
  'tees_and_fairways',
]

const DUTY_TITLES = {
  greenskeeper: 'Greenskeeper tasks',
  bunkers: 'Bunkers',
  greens: 'Greens',
  rolling: 'Rolling',
  spraying: 'Spraying',
  rough: 'Rough',
  tees_and_fairways: 'Tees and fairways',
}

// How many bunkers the sample hole has
export const SAMPLE_BUNKER_COUNT = 3

// Prince Waikiki's task list. Each task names the job titles that may check it off and the duty
// whose owner is answerable for it. A task in the bunker area repeats for every bunker.
export const TASK_TEMPLATES = [
  { id: 't-boxes-cleared', feature: 'tee_box', name: 'T-boxes cleared', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 't-boxes-mowed', feature: 'tee_box', name: 'T-boxes mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways' },
  { id: 'par-3-t-boxes-cleared', feature: 'tee_box', name: 'Par 3 T-boxes cleared', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'par-3-t-boxes-mowed', feature: 'tee_box', name: 'Par 3 T-boxes mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways' },
  { id: 'fairway-mowed', feature: 'fairway', name: 'Fairway mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways' },
  { id: 'cart-signs', feature: 'fairway', name: 'Cart signs removed and replaced', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'fairway-sprayed', feature: 'fairway', name: 'Fairway sprayed', allowedJobTitles: OPERATOR, duty: 'spraying' },
  { id: 'rough-mowed', feature: 'rough', name: 'Rough mowed', allowedJobTitles: OPERATOR, duty: 'rough' },
  { id: 'bunker-raked-machine', feature: 'bunker', name: 'Raked by machine', allowedJobTitles: OPERATOR, duty: 'bunkers' },
  { id: 'bunker-raked-hand', feature: 'bunker', name: 'Raked by hand', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'hole-placement-moved', feature: 'green', name: 'Hole placement moved', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'ball-marks', feature: 'green', name: 'Ball marks', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'top-dress', feature: 'green', name: 'Top dress', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper' },
  { id: 'green-mowed', feature: 'green', name: 'Mowed', allowedJobTitles: OPERATOR, duty: 'greens' },
  { id: 'green-rolled', feature: 'green', name: 'Rolled', allowedJobTitles: OPERATOR, duty: 'rolling' },
  { id: 'green-sprayed', feature: 'green', name: 'Sprayed', allowedJobTitles: OPERATOR, duty: 'spraying' },
]

export function formatFeatureTitle(feature) {
  return lookupLabel(FEATURE_TITLES, feature)
}

export function formatDutyTitle(duty) {
  return lookupLabel(DUTY_TITLES, duty)
}

function makeItem(template, bunkerNumber) {
  return {
    id: bunkerNumber ? `${template.id}:${bunkerNumber}` : template.id,
    templateId: template.id,
    feature: template.feature,
    name: template.name,
    allowedJobTitles: [...template.allowedJobTitles],
    duty: template.duty,
    bunkerNumber: bunkerNumber ?? null,
  }
}

// The tasks on one hole's checklist for a day. A bunker count that is not a whole number above
// zero counts as no bunkers.
export function buildChecklistItems(bunkerCount = SAMPLE_BUNKER_COUNT) {
  const bunkers = Number.isInteger(bunkerCount) && bunkerCount > 0 ? bunkerCount : 0
  const items = []

  for (const template of TASK_TEMPLATES) {
    if (template.feature !== 'bunker') {
      items.push(makeItem(template, null))
      continue
    }
    for (let bunkerNumber = 1; bunkerNumber <= bunkers; bunkerNumber++) {
      items.push(makeItem(template, bunkerNumber))
    }
  }

  return items
}

function isBunkerNumber(value) {
  return Number.isInteger(value) && value > 0
}

// Within an area, tasks with no bunker number come first, then each bunker in number order. A
// task keeps its place in the list within its section.
function buildSections(featureItems) {
  const unnumbered = featureItems.filter((item) => !isBunkerNumber(item.bunkerNumber))
  const bunkerNumbers = [
    ...new Set(featureItems.filter((item) => isBunkerNumber(item.bunkerNumber)).map((item) => item.bunkerNumber)),
  ].sort((first, second) => first - second)

  const sections = []
  if (unnumbered.length > 0) {
    sections.push({ key: 'all', title: null, items: unnumbered })
  }
  for (const bunkerNumber of bunkerNumbers) {
    sections.push({
      key: `bunker-${bunkerNumber}`,
      title: `Bunker ${bunkerNumber}`,
      items: featureItems.filter((item) => item.bunkerNumber === bunkerNumber),
    })
  }
  return sections
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

// The duties the tasks belong to, for the "Responsible today" list: the known ones in the page's
// order, then any it does not know under their own names. Tasks with no duty are skipped.
export function listDuties(items) {
  const present = new Set()

  for (const item of items ?? []) {
    if (typeof item.duty === 'string' && item.duty) {
      present.add(item.duty)
    }
  }

  const knownDuties = DUTY_ORDER.filter((duty) => present.has(duty))
  const otherDuties = [...present].filter((duty) => !DUTY_ORDER.includes(duty))

  return [...knownDuties, ...otherDuties].map((duty) => ({ key: duty, title: formatDutyTitle(duty) }))
}