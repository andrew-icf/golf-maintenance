import { FULL_DUTIES } from './checklistCases'
import { LUKE, YODA } from './taskPermissionCases'

// Test data for the "Responsible today" list
export const DUTIES = FULL_DUTIES

// People as an assignment describes them: who they are, and their job title
export const YODA_PERSON = { id: YODA.id, name: 'Yoda', jobTitle: 'greenskeeper' }
export const LUKE_PERSON = { id: LUKE.id, name: 'Luke Skywalker', jobTitle: 'operator' }
export const HAN_PERSON = { id: 'user-han', name: 'Han Solo', jobTitle: 'operator' }

// One person for every duty, in the order the duties are listed
export const FULL_ASSIGNMENTS = new Map([
  ['greenskeeper', [YODA_PERSON]],
  ['bunkers', [{ id: 'user-chewbacca', name: 'Chewbacca', jobTitle: 'operator' }]],
  ['greens', [LUKE_PERSON]],
  ['rolling', [HAN_PERSON]],
  ['spraying', [{ id: 'user-din', name: 'Din Djarin', jobTitle: 'operator' }]],
  ['rough', [{ id: 'user-lando', name: 'Lando Calrissian', jobTitle: 'operator' }]],
  ['tees_and_fairways', [{ id: 'user-finn', name: 'Finn', jobTitle: 'operator' }]],
])
export const FULL_ASSIGNMENT_NAMES = [
  ['Yoda'],
  ['Chewbacca'],
  ['Luke Skywalker'],
  ['Han Solo'],
  ['Din Djarin'],
  ['Lando Calrissian'],
  ['Finn'],
]

// Assignments that are not a Map of lists of people, so nobody is assigned to anything
export const NO_ASSIGNMENT_CASES = [
  { label: 'nothing', assignments: undefined },
  { label: 'null', assignments: null },
  { label: 'an empty map', assignments: new Map() },
  { label: 'a plain object', assignments: { greens: [LUKE_PERSON] } },
  { label: 'text', assignments: 'greens' },
]

// Duties given an empty list, null, or text in place of a list of people
export const ODD_LIST_ASSIGNMENTS = new Map([
  ['greens', []],
  ['rolling', null],
  ['spraying', 'Han Solo'],
])
export const ODD_LIST_DUTY_KEYS = ['greens', 'rolling', 'spraying']

export const SEVERAL_PEOPLE_ASSIGNMENTS = new Map([['bunkers', [HAN_PERSON, LUKE_PERSON]]])
export const EXPECTED_SEVERAL_NAMES = ['Han Solo', 'Luke Skywalker']

// The same person listed twice, once with a copy of their details
export const DUPLICATE_ASSIGNMENTS = new Map([['rolling', [HAN_PERSON, { ...HAN_PERSON }, LUKE_PERSON]]])
export const EXPECTED_DEDUPED_NAMES = ['Han Solo', 'Luke Skywalker']

// People with no usable id are all kept, since there is nothing to tell them apart by
export const NO_ID_ASSIGNMENTS = new Map([
  [
    'rolling',
    [
      { name: 'Temp One', jobTitle: 'operator' },
      { name: 'Temp Two', jobTitle: 'operator' },
      { id: '', name: 'Temp Three', jobTitle: 'operator' },
    ],
  ],
])

export const NAME_CASES = [
  { label: 'no name', person: { id: 'p1', jobTitle: 'operator' }, expected: 'Someone' },
  { label: 'a blank name', person: { id: 'p1', name: '   ' }, expected: 'Someone' },
  { label: 'a null name', person: { id: 'p1', name: null }, expected: 'Someone' },
  { label: 'a name that is a number', person: { id: 'p1', name: 42 }, expected: 'Someone' },
  { label: 'spaces around the name', person: { id: 'p1', name: '  Han Solo  ' }, expected: 'Han Solo' },
]

// The chip each job title gets: its label, and the color it is drawn in. "constructor" is a name
// every object has, which must not be mistaken for a job title.
export const TITLE_CASES = [
  { label: 'the greenskeeper title', jobTitle: 'greenskeeper', expectedLabel: 'Greenskeeper', expectedTone: 'greenskeeper' },
  { label: 'the operator title', jobTitle: 'operator', expectedLabel: 'Operator', expectedTone: 'operator' },
  { label: 'the landscaper title', jobTitle: 'landscaper', expectedLabel: 'Landscaper', expectedTone: 'other' },
  { label: 'a title it does not know', jobTitle: 'smuggler', expectedLabel: '', expectedTone: 'other' },
  { label: 'no title', jobTitle: null, expectedLabel: '', expectedTone: 'other' },
  { label: 'an inherited name', jobTitle: 'constructor', expectedLabel: '', expectedTone: 'other' },
]

// Someone assigned to a duty that is not on the list
export const UNLISTED_DUTY_ASSIGNMENTS = new Map([['mystery-duty', [HAN_PERSON]]])

export const NO_DUTIES_CASES = [
  { label: 'null', duties: null },
  { label: 'undefined', duties: undefined },
  { label: 'an empty list', duties: [] },
]

// Duties that are not quite right: only one of these is usable, and it has no title
export const ODD_DUTIES = [
  null,
  'text',
  { title: 'Nameless duty' },
  { key: '', title: 'Empty key' },
  { key: 'rolling' },
]
export const EXPECTED_ODD_DUTY_ENTRIES = [{ key: 'rolling', title: 'rolling', people: [] }]

// People who are not objects, mixed in with one who is
export const NON_OBJECT_PEOPLE_ASSIGNMENTS = new Map([['rolling', [null, 'Han Solo', 42, HAN_PERSON]]])
export const EXPECTED_NON_OBJECT_NAMES = ['Han Solo']

// Frozen, so any attempt to change them in place throws
export const FROZEN_DUTIES = Object.freeze(DUTIES.map((duty) => Object.freeze({ ...duty })))
export const FROZEN_PEOPLE_ASSIGNMENTS = new Map([
  ['rolling', Object.freeze([Object.freeze({ ...HAN_PERSON })])],
])

// What the preview names for each duty when nobody is looking
export const SAMPLE_PEOPLE_BY_DUTY = {
  greenskeeper: 'Yoda',
  bunkers: 'Chewbacca',
  greens: 'Wedge Antilles',
  rolling: 'Han Solo',
  spraying: 'Din Djarin',
  rough: 'Lando Calrissian',
  tees_and_fairways: 'Finn',
}

// Which duty the person looking takes in the preview, if any
export const VIEWER_SAMPLE_CASES = [
  { name: 'Luke, an operator', user: LUKE, replacedDuty: 'greens' },
  { name: 'Yoda, a greenskeeper', user: YODA, replacedDuty: 'greenskeeper' },
  {
    name: 'Mon Mothma, a superintendent',
    user: { id: 'user-mon', full_name: 'Mon Mothma', role: 'admin', job_title: 'superintendent' },
    replacedDuty: null,
  },
  {
    name: 'Ahsoka, a landscaper',
    user: { id: 'user-ahsoka', full_name: 'Ahsoka Tano', role: 'staff', job_title: 'landscaper' },
    replacedDuty: null,
  },
  { name: 'nobody', user: null, replacedDuty: null },
  {
    name: 'a person with no job title',
    user: { id: 'user-x', full_name: 'No Title', role: 'staff', job_title: null },
    replacedDuty: null,
  },
  {
    name: 'an operator with no id',
    user: { full_name: 'No Id', role: 'staff', job_title: 'operator' },
    replacedDuty: null,
  },
]

export const RESPONSIBLE_NOTE =
  'Each person checks off only their own work. These are the people answerable for this hole.'

// For the card: a duty with several kinds of people, to check which get a chip
export const CHIP_ASSIGNMENTS = new Map([
  [
    'rolling',
    [
      HAN_PERSON,
      { id: 'p2', name: 'No Title', jobTitle: null },
      { id: 'p3', name: 'Smuggler', jobTitle: 'smuggler' },
    ],
  ],
])

export const MARKUP_NAME = '<b>Han</b>'
export const MARKUP_ASSIGNMENTS = new Map([['rolling', [{ id: 'p1', name: MARKUP_NAME, jobTitle: 'operator' }]]])