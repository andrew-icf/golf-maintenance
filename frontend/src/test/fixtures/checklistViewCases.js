import { SAMPLE_DAY, SAMPLE_MARK_DESCRIPTIONS, atTime, doneMark } from './checklistCases'
import { AHSOKA, ANAKIN, JYN, LEIA, LUKE, MON_MOTHMA, OBI_WAN, YODA } from './taskPermissionCases'

// Test data for showing the checklist. The sample hole has 21 tasks: 10 are for greenskeepers and
// 11 for operators. The sample marks leave 3 greenskeeper tasks done, 2 operator tasks done, 3
// operator tasks set aside, and the other 13 open.
export { SAMPLE_DAY }

// How many checkboxes are enabled for each person: the tasks they may check, whether done or not,
// except the three that were set aside, whose boxes are always disabled
export const ENABLED_COUNT_CASES = [
  { name: 'Yoda, a greenskeeper', user: YODA, expected: 10 },
  { name: 'Luke, an operator', user: LUKE, expected: 8 },
  { name: 'Ahsoka, a landscaper', user: AHSOKA, expected: 0 },
  { name: 'Anakin, a mechanic', user: ANAKIN, expected: 0 },
  { name: 'Jyn, an office admin', user: JYN, expected: 0 },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, expected: 18 },
  { name: 'Leia, an assistant superintendent', user: LEIA, expected: 18 },
  { name: 'Obi-Wan, a master mechanic', user: OBI_WAN, expected: 18 },
]

// How many locks each person sees, for the open tasks they may not check: 7 open greenskeeper
// tasks and 6 open operator tasks
export const LOCK_CASES = [
  { name: 'Luke, an operator', user: LUKE, greenskeeperLocks: 7, operatorLocks: 0 },
  { name: 'Yoda, a greenskeeper', user: YODA, greenskeeperLocks: 0, operatorLocks: 6 },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, greenskeeperLocks: 0, operatorLocks: 0 },
  { name: 'Ahsoka, a landscaper', user: AHSOKA, greenskeeperLocks: 7, operatorLocks: 6 },
]

// How many Not today and Undo buttons each person sees: Not today on the open tasks they may
// check, and Undo on the three that were set aside, when they may check those
export const ACTION_COUNT_CASES = [
  { name: 'Luke, an operator', user: LUKE, notToday: 6, undo: 3 },
  { name: 'Yoda, a greenskeeper', user: YODA, notToday: 7, undo: 0 },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, notToday: 13, undo: 3 },
  { name: 'Ahsoka, a landscaper', user: AHSOKA, notToday: 0, undo: 0 },
]

// Every checkbox's name, in the order the page reads them
export const EXPECTED_CHECKBOX_LABELS = [
  'Tee box: Collect garbage',
  'Tee box: Cleared',
  'Tee box: Mowed',
  'Tee box, Par 3 tee box: Cleared',
  'Tee box, Par 3 tee box: Mowed',
  'Fairway: Cart signs',
  'Fairway: Fairway mowed',
  'Fairway: Fairway sprayed',
  'Rough: Rough mowed',
  'Bunkers, Bunker 1: Raked by hand',
  'Bunkers, Bunker 1: Raked by machine',
  'Bunkers, Bunker 2: Raked by hand',
  'Bunkers, Bunker 2: Raked by machine',
  'Bunkers, Bunker 3: Raked by hand',
  'Bunkers, Bunker 3: Raked by machine',
  'Green: Pin placement',
  'Green: Ball marks',
  'Green: Top dress',
  'Green: Mowed',
  'Green: Rolled',
  'Green: Sprayed',
]

export const EXPECTED_AREA_HEADINGS = ['Tee box', 'Fairway', 'Rough', 'Bunkers', 'Green']
export const EXPECTED_SECTION_HEADINGS = ['Tee box', 'Par 3 tee box', 'Bunker 1', 'Bunker 2', 'Bunker 3']

// What the page says under the tasks that were checked, and how many were set aside
export const DONE_DESCRIPTIONS = SAMPLE_MARK_DESCRIPTIONS.filter((entry) => entry.expected !== 'Not today').map(
  (entry) => entry.expected
)
export const SET_ASIDE_COUNT = SAMPLE_MARK_DESCRIPTIONS.filter((entry) => entry.expected === 'Not today').length

// Luke has checked the tee box mowing himself
export const LUKES_OWN_CHECK = { id: 'tee-box-mowed', mark: doneMark(LUKE.id, 'Luke Skywalker', atTime(6, 12)) }
export const LUKES_OWN_CHECK_TEXT = 'You · 6:12am'

// The text the page shows for the sample marks, and for one more task accounted for
export const SAMPLE_COUNT_TEXT = '8 of 21 tasks accounted for'
export const ONE_MORE_COUNT_TEXT = '9 of 21 tasks accounted for'
export const ALL_DONE_COUNT_TEXT = '21 of 21 tasks accounted for'
export const ALL_DONE_NOTE = 'Every task is accounted for.'
export const NO_TASKS_NOTE = 'There are no tasks for this hole today.'
export const PREVIEW_NOTICE = 'Preview with sample tasks. Checks are not saved.'