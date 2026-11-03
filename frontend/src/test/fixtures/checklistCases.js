import { LUKE } from './taskPermissionCases'

// Test data for the checklist: the task list as it should read, how it is laid out on the page,
// and the odd lists it has to cope with. Today in these tests is Wednesday 2026-10-21.
export const SAMPLE_DAY = '2026-10-21'

// A moment on that day, in the device's own time
export function atTime(hours, minutes) {
  return new Date(2026, 9, 21, hours, minutes).getTime()
}

export const NOW = atTime(6, 12)

// A person besides the ones in the permission cases
export const HAN_SOLO = { id: 'user-han', full_name: 'Han Solo', role: 'staff', job_title: 'operator' }

export function makeChecklistItem({
  id,
  feature = 'green',
  name = 'A task',
  duty = 'greens',
  bunkerNumber = null,
  allowedJobTitles = ['operator'],
}) {
  return { id, templateId: id, feature, name, allowedJobTitles, duty, bunkerNumber }
}

export function doneMark(byId, byName, at) {
  return { status: 'done', byId, byName, at }
}

export function notTodayMark(byId, byName, at) {
  return { status: 'not_today', byId, byName, at }
}

// The task list, written out by hand so it is checked against the code
export const EXPECTED_TASKS = [
  { id: 't-boxes-cleared', feature: 'tee_box', name: 'T-boxes cleared', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 't-boxes-mowed', feature: 'tee_box', name: 'T-boxes mowed', duty: 'tees_and_fairways', titles: ['operator'] },
  { id: 'par-3-t-boxes-cleared', feature: 'tee_box', name: 'Par 3 T-boxes cleared', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'par-3-t-boxes-mowed', feature: 'tee_box', name: 'Par 3 T-boxes mowed', duty: 'tees_and_fairways', titles: ['operator'] },
  { id: 'fairway-mowed', feature: 'fairway', name: 'Fairway mowed', duty: 'tees_and_fairways', titles: ['operator'] },
  { id: 'cart-signs', feature: 'fairway', name: 'Cart signs removed and replaced', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'fairway-sprayed', feature: 'fairway', name: 'Fairway sprayed', duty: 'spraying', titles: ['operator'] },
  { id: 'rough-mowed', feature: 'rough', name: 'Rough mowed', duty: 'rough', titles: ['operator'] },
  { id: 'bunker-raked-machine', feature: 'bunker', name: 'Raked by machine', duty: 'bunkers', titles: ['operator'] },
  { id: 'bunker-raked-hand', feature: 'bunker', name: 'Raked by hand', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'hole-placement-moved', feature: 'green', name: 'Hole placement moved', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'ball-marks', feature: 'green', name: 'Ball marks', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'top-dress', feature: 'green', name: 'Top dress', duty: 'greenskeeper', titles: ['greenskeeper'] },
  { id: 'green-mowed', feature: 'green', name: 'Mowed', duty: 'greens', titles: ['operator'] },
  { id: 'green-rolled', feature: 'green', name: 'Rolled', duty: 'rolling', titles: ['operator'] },
  { id: 'green-sprayed', feature: 'green', name: 'Sprayed', duty: 'spraying', titles: ['operator'] },
]

// 14 tasks outside the bunkers, plus two for each bunker
export const ITEMS_WITHOUT_BUNKERS = 14
export const SAMPLE_ITEM_COUNT = 20

export const ITEM_COUNT_CASES = [
  { bunkerCount: 0, expected: 14 },
  { bunkerCount: 1, expected: 16 },
  { bunkerCount: 3, expected: 20 },
  { bunkerCount: 5, expected: 24 },
  { bunkerCount: 12, expected: 38 },
]

export const INVALID_BUNKER_COUNT_CASES = [
  { label: 'a negative number', bunkerCount: -1 },
  { label: 'a fraction', bunkerCount: 2.5 },
  { label: 'not a number', bunkerCount: NaN },
  { label: 'text', bunkerCount: '3' },
  { label: 'null', bunkerCount: null },
]

// For the sample hole of three bunkers
export const FEATURE_COUNT_CASES = [
  { feature: 'tee_box', count: 4 },
  { feature: 'fairway', count: 3 },
  { feature: 'rough', count: 1 },
  { feature: 'bunker', count: 6 },
  { feature: 'green', count: 6 },
]

// The layout of the sample hole's checklist: each area, its sections, and the tasks in them
const BUNKER_SECTIONS = [1, 2, 3].map((bunkerNumber) => ({
  title: `Bunker ${bunkerNumber}`,
  names: ['Raked by machine', 'Raked by hand'],
}))

export const EXPECTED_GROUPS = [
  {
    title: 'Tee box',
    sections: [
      {
        title: null,
        names: ['T-boxes cleared', 'T-boxes mowed', 'Par 3 T-boxes cleared', 'Par 3 T-boxes mowed'],
      },
    ],
  },
  {
    title: 'Fairway',
    sections: [{ title: null, names: ['Fairway mowed', 'Cart signs removed and replaced', 'Fairway sprayed'] }],
  },
  { title: 'Rough', sections: [{ title: null, names: ['Rough mowed'] }] },
  { title: 'Bunkers', sections: BUNKER_SECTIONS },
  {
    title: 'Green',
    sections: [
      {
        title: null,
        names: ['Hole placement moved', 'Ball marks', 'Top dress', 'Mowed', 'Rolled', 'Sprayed'],
      },
    ],
  },
]

export const NO_ITEMS_CASES = [
  { label: 'null', items: null },
  { label: 'undefined', items: undefined },
  { label: 'an empty list', items: [] },
]

// Bunker tasks that arrive out of order: each bunker's tasks keep the order they arrived in
export const OUT_OF_ORDER_BUNKER_ITEMS = [
  makeChecklistItem({ id: 'b3-hand', feature: 'bunker', name: 'Raked by hand', bunkerNumber: 3 }),
  makeChecklistItem({ id: 'b1-machine', feature: 'bunker', name: 'Raked by machine', bunkerNumber: 1 }),
  makeChecklistItem({ id: 'b2-hand', feature: 'bunker', name: 'Raked by hand', bunkerNumber: 2 }),
  makeChecklistItem({ id: 'b1-hand', feature: 'bunker', name: 'Raked by hand', bunkerNumber: 1 }),
  makeChecklistItem({ id: 'b3-machine', feature: 'bunker', name: 'Raked by machine', bunkerNumber: 3 }),
  makeChecklistItem({ id: 'b2-machine', feature: 'bunker', name: 'Raked by machine', bunkerNumber: 2 }),
]
export const EXPECTED_OUT_OF_ORDER_SECTIONS = [
  { title: 'Bunker 1', ids: ['b1-machine', 'b1-hand'] },
  { title: 'Bunker 2', ids: ['b2-hand', 'b2-machine'] },
  { title: 'Bunker 3', ids: ['b3-hand', 'b3-machine'] },
]

// A bunker area that has a task with no bunker number, which goes first, untitled
export const MIXED_BUNKER_ITEMS = [
  makeChecklistItem({ id: 'two', feature: 'bunker', bunkerNumber: 2 }),
  makeChecklistItem({ id: 'general', feature: 'bunker', bunkerNumber: null }),
  makeChecklistItem({ id: 'one', feature: 'bunker', bunkerNumber: 1 }),
]
export const EXPECTED_MIXED_SECTIONS = [
  { title: null, ids: ['general'] },
  { title: 'Bunker 1', ids: ['one'] },
  { title: 'Bunker 2', ids: ['two'] },
]

// An area the page does not know follows the known ones, under its own name
export const UNKNOWN_FEATURE_ITEMS = [
  makeChecklistItem({ id: 'sprinkler-check', feature: 'irrigation' }),
  makeChecklistItem({ id: 'green-task', feature: 'green' }),
  makeChecklistItem({ id: 'tee-task', feature: 'tee_box' }),
]
export const EXPECTED_UNKNOWN_FEATURE_TITLES = ['Tee box', 'Green', 'irrigation']

// Tasks with no area come last, under "Other", even after an area the page does not know
export const MISSING_FEATURE_ITEMS = [
  makeChecklistItem({ id: 'no-area', feature: null }),
  makeChecklistItem({ id: 'sprinkler-check', feature: 'irrigation' }),
  makeChecklistItem({ id: 'green-task', feature: 'green' }),
  makeChecklistItem({ id: 'blank-area', feature: '' }),
]
export const EXPECTED_MISSING_FEATURE_TITLES = ['Green', 'irrigation', 'Other']
export const EXPECTED_OTHER_IDS = ['no-area', 'blank-area']

// Frozen, so any attempt to reorder or change them in place throws
export const FROZEN_ITEMS = Object.freeze([
  Object.freeze(makeChecklistItem({ id: 'b2-hand', feature: 'bunker', bunkerNumber: 2 })),
  Object.freeze(makeChecklistItem({ id: 'b1-hand', feature: 'bunker', bunkerNumber: 1 })),
  Object.freeze(makeChecklistItem({ id: 'green-task', feature: 'green' })),
])

// Duties as the "Responsible today" list reads them
export const FULL_DUTIES = [
  { key: 'greenskeeper', title: 'Greenskeeper tasks' },
  { key: 'bunkers', title: 'Bunkers' },
  { key: 'greens', title: 'Greens' },
  { key: 'rolling', title: 'Rolling' },
  { key: 'spraying', title: 'Spraying' },
  { key: 'rough', title: 'Rough' },
  { key: 'tees_and_fairways', title: 'Tees and fairways' },
]

export const GREENS_ONLY_ITEMS = [makeChecklistItem({ id: 'green-mowed', duty: 'greens' })]
export const GREENS_ONLY_DUTIES = [{ key: 'greens', title: 'Greens' }]

// A duty listed twice counts once, an unknown duty follows the known ones, and a task with no
// duty is skipped
export const MIXED_DUTY_ITEMS = [
  makeChecklistItem({ id: 'a', duty: 'greens' }),
  makeChecklistItem({ id: 'b', duty: 'greenskeeper' }),
  makeChecklistItem({ id: 'c', duty: 'mystery' }),
  makeChecklistItem({ id: 'd', duty: 'rolling' }),
  makeChecklistItem({ id: 'e', duty: null }),
  makeChecklistItem({ id: 'f', duty: 'greens' }),
]
export const EXPECTED_MIXED_DUTIES = [
  { key: 'greenskeeper', title: 'Greenskeeper tasks' },
  { key: 'greens', title: 'Greens' },
  { key: 'rolling', title: 'Rolling' },
  { key: 'mystery', title: 'mystery' },
]

export const DUTY_TITLE_CASES = [
  { duty: 'greenskeeper', expected: 'Greenskeeper tasks' },
  { duty: 'tees_and_fairways', expected: 'Tees and fairways' },
  { duty: 'mystery', expected: 'mystery' },
]

export const FEATURE_TITLE_CASES = [
  { feature: 'tee_box', expected: 'Tee box' },
  { feature: 'bunker', expected: 'Bunkers' },
  { feature: 'irrigation', expected: 'irrigation' },
]

// What the page says under a task for each kind of mark
export const DESCRIBE_MARK_CASES = [
  {
    label: 'a task done by someone else',
    mark: doneMark('user-yoda', 'Yoda', atTime(5, 48)),
    user: LUKE,
    expected: 'Yoda · 5:48am',
  },
  {
    label: 'a task done by the person looking',
    mark: doneMark(LUKE.id, 'Luke Skywalker', atTime(6, 12)),
    user: LUKE,
    expected: 'You · 6:12am',
  },
  {
    label: 'a task done by someone else when nobody is looking',
    mark: doneMark('user-yoda', 'Yoda', atTime(5, 48)),
    user: null,
    expected: 'Yoda · 5:48am',
  },
  {
    label: 'a task done by someone with no name',
    mark: doneMark('user-yoda', '', atTime(5, 48)),
    user: LUKE,
    expected: 'Someone · 5:48am',
  },
  {
    label: 'a mark with no ids, looked at by a person with no id',
    mark: { status: 'done', byName: 'Yoda', at: atTime(5, 48) },
    user: {},
    expected: 'Yoda · 5:48am',
  },
  {
    label: 'a task done at a time that cannot be read',
    mark: doneMark('user-yoda', 'Yoda', NaN),
    user: LUKE,
    expected: 'Yoda',
  },
  {
    label: 'a task set aside for today',
    mark: notTodayMark('user-yoda', 'Yoda', atTime(5, 30)),
    user: LUKE,
    expected: 'Not today',
  },
  { label: 'a task with no mark', mark: undefined, user: LUKE, expected: '' },
  {
    label: 'a mark with a status it does not know',
    mark: { status: 'mystery', byId: 'user-yoda', byName: 'Yoda', at: atTime(5, 48) },
    user: LUKE,
    expected: '',
  },
]

export const FORMAT_TIME_CASES = [
  { label: 'just after midnight', hours: 0, minutes: 5, expected: '12:05am' },
  { label: 'a morning time', hours: 5, minutes: 48, expected: '5:48am' },
  { label: 'a single-digit minute', hours: 9, minutes: 5, expected: '9:05am' },
  { label: 'noon', hours: 12, minutes: 0, expected: '12pm' },
  { label: 'the afternoon', hours: 13, minutes: 30, expected: '1:30pm' },
  { label: 'the last minute of the day', hours: 23, minutes: 59, expected: '11:59pm' },
]

export const INVALID_TIME_CASES = [
  { label: 'not a number', atMs: NaN },
  { label: 'nothing', atMs: undefined },
  { label: 'text', atMs: 'banana' },
]

// What the page says under each of the sample marks, for someone who made none of them
export const SAMPLE_MARK_DESCRIPTIONS = [
  { id: 't-boxes-cleared', expected: 'Yoda · 5:48am' },
  { id: 'par-3-t-boxes-cleared', expected: 'Yoda · 5:50am' },
  { id: 'hole-placement-moved', expected: 'Padmé Amidala · 5:40am' },
  { id: 'fairway-mowed', expected: 'Chewbacca · 6:40am' },
  { id: 'bunker-raked-machine:1', expected: 'Chewbacca · 6:55am' },
  { id: 'fairway-sprayed', expected: 'Not today' },
  { id: 'green-rolled', expected: 'Not today' },
  { id: 'green-sprayed', expected: 'Not today' },
]