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

// A tee box has its own section on the page, and the par 3 tee box a second one after it
const TEE_BOX_SECTION = { key: 'tee-box', title: 'Tee box', order: 1 }
const PAR_3_TEE_BOX_SECTION = { key: 'par-3-tee-box', title: 'Par 3 tee box', order: 2 }

// Prince Waikiki's task list. Each task names the job titles that may check it off and the duty
// whose owner is answerable for it. A task that repeats for every bunker makes its own section
// for each one. Every task can happen every day: which ones are on for a given day is decided by
// the superintendent's plan for the week, not by rules built into the tasks.
export const TASK_TEMPLATES = [
  {
    id: 'collect-garbage', feature: 'tee_box', section: null,
    name: 'Collect garbage', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'tee-box-cleared', feature: 'tee_box', section: TEE_BOX_SECTION,
    name: 'Cleared', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'tee-box-mowed', feature: 'tee_box', section: TEE_BOX_SECTION,
    name: 'Mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways',
  },
  {
    id: 'par-3-tee-box-cleared', feature: 'tee_box', section: PAR_3_TEE_BOX_SECTION,
    name: 'Cleared', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'par-3-tee-box-mowed', feature: 'tee_box', section: PAR_3_TEE_BOX_SECTION,
    name: 'Mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways',
  },
  {
    id: 'fairway-mowed', feature: 'fairway', section: null,
    name: 'Fairway mowed', allowedJobTitles: OPERATOR, duty: 'tees_and_fairways',
  },
  {
    id: 'cart-signs', feature: 'fairway', section: null,
    name: 'Cart signs', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'fairway-sprayed', feature: 'fairway', section: null,
    name: 'Fairway sprayed', allowedJobTitles: OPERATOR, duty: 'spraying',
  },
  {
    id: 'rough-mowed', feature: 'rough', section: null,
    name: 'Rough mowed', allowedJobTitles: OPERATOR, duty: 'rough',
  },
  {
    id: 'bunker-raked-machine', feature: 'bunker', section: null, repeatsPerBunker: true,
    name: 'Raked by machine', allowedJobTitles: OPERATOR, duty: 'bunkers',
  },
  {
    id: 'bunker-raked-hand', feature: 'bunker', section: null, repeatsPerBunker: true,
    name: 'Raked by hand', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'pin-placement', feature: 'green', section: null,
    name: 'Pin placement', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'ball-marks', feature: 'green', section: null,
    name: 'Ball marks', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'top-dress', feature: 'green', section: null,
    name: 'Top dress', allowedJobTitles: GREENSKEEPER, duty: 'greenskeeper',
  },
  {
    id: 'green-mowed', feature: 'green', section: null,
    name: 'Mowed', allowedJobTitles: OPERATOR, duty: 'greens',
  },
  {
    id: 'green-rolled', feature: 'green', section: null,
    name: 'Rolled', allowedJobTitles: OPERATOR, duty: 'rolling',
  },
  {
    id: 'green-sprayed', feature: 'green', section: null,
    name: 'Sprayed', allowedJobTitles: OPERATOR, duty: 'spraying',
  },
]

export function formatFeatureTitle(feature) {
  return lookupLabel(FEATURE_TITLES, feature)
}

export function formatDutyTitle(duty) {
  return lookupLabel(DUTY_TITLES, duty)
}

function makeItem(template, bunkerNumber) {
  const section = bunkerNumber
    ? { key: `bunker-${bunkerNumber}`, title: `Bunker ${bunkerNumber}`, order: bunkerNumber }
    : template.section

  return {
    id: bunkerNumber ? `${template.id}:${bunkerNumber}` : template.id,
    templateId: template.id,
    feature: template.feature,
    name: template.name,
    allowedJobTitles: [...template.allowedJobTitles],
    duty: template.duty,
    section: section ? { ...section } : null,
  }
}

// The tasks on one hole's checklist. A bunker count that is not a whole number above zero counts
// as no bunkers.
export function buildChecklistItems(bunkerCount = SAMPLE_BUNKER_COUNT) {
  const bunkers = Number.isInteger(bunkerCount) && bunkerCount > 0 ? bunkerCount : 0
  const items = []

  for (const template of TASK_TEMPLATES) {
    if (!template.repeatsPerBunker) {
      items.push(makeItem(template, null))
      continue
    }
    for (let bunkerNumber = 1; bunkerNumber <= bunkers; bunkerNumber++) {
      items.push(makeItem(template, bunkerNumber))
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