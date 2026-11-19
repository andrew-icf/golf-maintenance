import { buildChecklistItems, buildSampleFeatures } from '../../features/hole/checklist/checklistTasks'

// Test data for the club's task list, as GET /api/hole-tasks sends it. SAMPLE_TASK_LIST is Prince
// Waikiki's default list, written out by hand to match backend/seed/default_tasks.sql.

export function makeDuty(code, name, position) {
  return { id: `duty-${code}`, code, name, position }
}

export function makeTask({ code, featureType, name, jobTitles, dutyCode, position }) {
  return {
    id: `task-${code}`,
    code,
    feature_type: featureType,
    name,
    allowed_job_titles: jobTitles,
    duty_id: `duty-${dutyCode}`,
    position,
  }
}

const GREENSKEEPER = ['greenskeeper']
const OPERATOR = ['operator']

export const SAMPLE_DUTIES = [
  makeDuty('greenskeeper', 'Greenskeeper tasks', 1),
  makeDuty('bunkers', 'Bunkers', 2),
  makeDuty('greens', 'Greens', 3),
  makeDuty('rolling', 'Rolling', 4),
  makeDuty('spraying', 'Spraying', 5),
  makeDuty('rough', 'Rough', 6),
  makeDuty('tees_and_fairways', 'Tees and fairways', 7),
]

export const SAMPLE_TASKS = [
  makeTask({ code: 'tee-box-cleared', featureType: 'tee_box', name: 'Cleared', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 1 }),
  makeTask({ code: 'collect-garbage', featureType: 'tee_box', name: 'Collect garbage', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 2 }),
  makeTask({ code: 'tee-box-mowed', featureType: 'tee_box', name: 'Mowed', jobTitles: OPERATOR, dutyCode: 'tees_and_fairways', position: 3 }),
  makeTask({ code: 'par-3-tee-box-cleared', featureType: 'par_3_tee_box', name: 'Cleared', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 4 }),
  makeTask({ code: 'par-3-tee-box-mowed', featureType: 'par_3_tee_box', name: 'Mowed', jobTitles: OPERATOR, dutyCode: 'tees_and_fairways', position: 5 }),
  makeTask({ code: 'fairway-mowed', featureType: 'fairway', name: 'Fairway mowed', jobTitles: OPERATOR, dutyCode: 'tees_and_fairways', position: 6 }),
  makeTask({ code: 'cart-signs', featureType: 'fairway', name: 'Cart signs', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 7 }),
  makeTask({ code: 'fairway-sprayed', featureType: 'fairway', name: 'Fairway sprayed', jobTitles: OPERATOR, dutyCode: 'spraying', position: 8 }),
  makeTask({ code: 'rough-mowed', featureType: 'rough', name: 'Rough mowed', jobTitles: OPERATOR, dutyCode: 'rough', position: 9 }),
  makeTask({ code: 'bunker-raked-machine', featureType: 'bunker', name: 'Raked by machine', jobTitles: OPERATOR, dutyCode: 'bunkers', position: 10 }),
  makeTask({ code: 'bunker-raked-hand', featureType: 'bunker', name: 'Raked by hand', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 11 }),
  makeTask({ code: 'pin-placement', featureType: 'green', name: 'Pin placement', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 12 }),
  makeTask({ code: 'ball-marks', featureType: 'green', name: 'Ball marks', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 13 }),
  makeTask({ code: 'top-dress', featureType: 'green', name: 'Top dress', jobTitles: GREENSKEEPER, dutyCode: 'greenskeeper', position: 14 }),
  makeTask({ code: 'green-mowed', featureType: 'green', name: 'Mowed', jobTitles: OPERATOR, dutyCode: 'greens', position: 15 }),
  makeTask({ code: 'green-rolled', featureType: 'green', name: 'Rolled', jobTitles: OPERATOR, dutyCode: 'rolling', position: 16 }),
  makeTask({ code: 'green-sprayed', featureType: 'green', name: 'Sprayed', jobTitles: OPERATOR, dutyCode: 'spraying', position: 17 }),
]

export const SAMPLE_TASK_LIST = { duties: SAMPLE_DUTIES, tasks: SAMPLE_TASKS }

// The checklist for a hole like the sample one: the standard six features and this many bunkers
export function buildSampleItems(bunkerCount) {
  return buildChecklistItems(buildSampleFeatures(bunkerCount), SAMPLE_TASK_LIST)
}

// The duty each task belongs to, written out by hand so the builder is checked against it
export const EXPECTED_DUTY_BY_TASK = {
  'tee-box-cleared': 'greenskeeper',
  'collect-garbage': 'greenskeeper',
  'tee-box-mowed': 'tees_and_fairways',
  'par-3-tee-box-cleared': 'greenskeeper',
  'par-3-tee-box-mowed': 'tees_and_fairways',
  'fairway-mowed': 'tees_and_fairways',
  'cart-signs': 'greenskeeper',
  'fairway-sprayed': 'spraying',
  'rough-mowed': 'rough',
  'bunker-raked-machine': 'bunkers',
  'bunker-raked-hand': 'greenskeeper',
  'pin-placement': 'greenskeeper',
  'ball-marks': 'greenskeeper',
  'top-dress': 'greenskeeper',
  'green-mowed': 'greens',
  'green-rolled': 'rolling',
  'green-sprayed': 'spraying',
}

// A list with one task that is not in the default list, for a different club
export const CUSTOM_TASK_LIST = {
  duties: [makeDuty('inspection', 'Inspection', 1)],
  tasks: [
    makeTask({
      code: 'green-inspected',
      featureType: 'green',
      name: 'Inspected',
      jobTitles: ['mechanic'],
      dutyCode: 'inspection',
      position: 1,
    }),
  ],
}

// Task lists that hold no usable tasks
export const NO_TASK_LIST_CASES = [
  { label: 'null', taskList: null },
  { label: 'undefined', taskList: undefined },
  { label: 'an empty object', taskList: {} },
  { label: 'tasks that are text, not a list', taskList: { duties: SAMPLE_DUTIES, tasks: 'tee-box-cleared' } },
  { label: 'an empty list of tasks', taskList: { duties: SAMPLE_DUTIES, tasks: [] } },
]

const EXTRA_TASK = makeTask({
  code: 'extra',
  featureType: 'green',
  name: 'Extra',
  jobTitles: OPERATOR,
  dutyCode: 'greens',
  position: 18,
})

// Entries that cannot be a task, added to the default list, which must not make a task
export const UNUSABLE_TASK_CASES = [
  { label: 'a task with no code', entry: { ...EXTRA_TASK, code: undefined } },
  { label: 'a task with an empty code', entry: { ...EXTRA_TASK, code: '' } },
  { label: 'a task with no id', entry: { ...EXTRA_TASK, id: undefined } },
  { label: 'a task with a blank id', entry: { ...EXTRA_TASK, id: '   ' } },
  { label: 'a task with no feature type', entry: { ...EXTRA_TASK, feature_type: undefined } },
  { label: 'a task with no name', entry: { ...EXTRA_TASK, name: undefined } },
  { label: 'a task with a blank name', entry: { ...EXTRA_TASK, name: '   ' } },
  { label: 'an entry that is null', entry: null },
  { label: 'an entry that is text', entry: 'green-mowed' },
]

// A green task whose list of job titles is not a list of titles, so only admins may check it
export const ODD_TASK_TITLE_CASES = [
  { label: 'no list', task: { ...EXTRA_TASK, allowed_job_titles: undefined } },
  { label: 'a list that is null', task: { ...EXTRA_TASK, allowed_job_titles: null } },
  { label: 'a list that is text', task: { ...EXTRA_TASK, allowed_job_titles: 'operator' } },
  { label: 'an empty list', task: { ...EXTRA_TASK, allowed_job_titles: [] } },
]

// A task whose duty is not in the list of duties
export const UNKNOWN_DUTY_TASK_LIST = {
  duties: SAMPLE_DUTIES,
  tasks: [{ ...EXTRA_TASK, duty_id: 'duty-ghost' }],
}

// A task for a kind of feature the page does not know
export const UNKNOWN_FEATURE_TASK_LIST = {
  duties: SAMPLE_DUTIES,
  tasks: [makeTask({ code: 'dugout-swept', featureType: 'dugout', name: 'Swept', jobTitles: OPERATOR, dutyCode: 'greens', position: 1 })],
}

// Frozen all the way down, so any attempt to change it in place throws
export const FROZEN_TASK_LIST = Object.freeze({
  duties: Object.freeze(SAMPLE_DUTIES.map((duty) => Object.freeze({ ...duty }))),
  tasks: Object.freeze(
    SAMPLE_TASKS.map((task) =>
      Object.freeze({ ...task, allowed_job_titles: Object.freeze([...task.allowed_job_titles]) })
    )
  ),
})

export const REVERSED_DUTIES = [...SAMPLE_DUTIES].reverse()

// What a duty is titled, with and without a usable name. Its code is the fallback.
export const DUTY_NAME_CASES = [
  { label: 'a name', name: 'Greens', expected: 'Greens' },
  { label: 'an empty name', name: '', expected: 'greens' },
  { label: 'a blank name', name: '   ', expected: 'greens' },
  { label: 'no name', name: undefined, expected: 'greens' },
  { label: 'a name that is a number', name: 42, expected: 'greens' },
]

// A list of duties that is not a list, so every duty is titled by its code
export const NO_DUTY_LIST_CASES = [
  { label: 'null', duties: null },
  { label: 'undefined', duties: undefined },
  { label: 'text', duties: 'greens' },
]
export const EXPECTED_NO_LIST_DUTIES = [
  { key: 'greens', title: 'greens' },
  { key: 'greenskeeper', title: 'greenskeeper' },
  { key: 'mystery', title: 'mystery' },
  { key: 'rolling', title: 'rolling' },
]

// The ids the sample hole's tasks carry, written out by hand. taskId is the task's own id, and
// featureId the id of the feature of the hole it is on, as buildSampleFeatures makes them.
export const ITEM_ID_CASES = [
  { itemId: 'tee-box-cleared', taskId: 'task-tee-box-cleared', featureId: 'sample-tee_box' },
  { itemId: 'collect-garbage', taskId: 'task-collect-garbage', featureId: 'sample-tee_box' },
  { itemId: 'tee-box-mowed', taskId: 'task-tee-box-mowed', featureId: 'sample-tee_box' },
  { itemId: 'par-3-tee-box-cleared', taskId: 'task-par-3-tee-box-cleared', featureId: 'sample-par_3_tee_box' },
  { itemId: 'fairway-sprayed', taskId: 'task-fairway-sprayed', featureId: 'sample-fairway' },
  { itemId: 'rough-mowed', taskId: 'task-rough-mowed', featureId: 'sample-rough' },
  { itemId: 'green-rolled', taskId: 'task-green-rolled', featureId: 'sample-green' },
  { itemId: 'bunker-raked-machine:1', taskId: 'task-bunker-raked-machine', featureId: 'sample-bunker-1' },
  { itemId: 'bunker-raked-hand:3', taskId: 'task-bunker-raked-hand', featureId: 'sample-bunker-3' },
]