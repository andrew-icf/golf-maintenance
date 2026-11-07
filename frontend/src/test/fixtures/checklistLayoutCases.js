import { makeChecklistItem } from './checklistCases'
import { AHSOKA, ANAKIN, JYN, LEIA, LUKE, MON_MOTHMA, OBI_WAN, YODA } from './taskPermissionCases'

// Test data for laying the checklist out in a column for each role

// Which of the sample hole's two columns, Greenskeeper then Operator, belong to each person
export const VIEWER_CASES = [
  { name: 'Yoda, a greenskeeper', user: YODA, expectedYours: [true, false] },
  { name: 'Luke, an operator', user: LUKE, expectedYours: [false, true] },
  { name: 'Ahsoka, a landscaper', user: AHSOKA, expectedYours: [false, false] },
  { name: 'Anakin, a mechanic', user: ANAKIN, expectedYours: [false, false] },
  { name: 'Jyn, an office admin', user: JYN, expectedYours: [false, false] },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, expectedYours: [true, true] },
  { name: 'Leia, an assistant superintendent', user: LEIA, expectedYours: [true, true] },
  { name: 'Obi-Wan, a master mechanic', user: OBI_WAN, expectedYours: [true, true] },
]

// People who are not quite what the server sends
export const ODD_VIEWER_CASES = [
  {
    label: 'a role spelled "Admin", which the server does not accept',
    user: { role: 'Admin', job_title: null },
    expectedYours: [false, false],
  },
  {
    label: 'an admin who also has an operator job title',
    user: { role: 'admin', job_title: 'operator' },
    expectedYours: [true, true],
  },
  {
    label: 'a job title with a capital letter',
    user: { role: 'staff', job_title: 'Greenskeeper' },
    expectedYours: [false, false],
  },
  {
    label: 'staff with no job title',
    user: { role: 'staff', job_title: null },
    expectedYours: [false, false],
  },
]

// The sample hole as the page draws it: for each area and section, the names of the tasks in
// each column
const BUNKER_SECTIONS = [1, 2, 3].map((bunkerNumber) => ({
  title: `Bunker ${bunkerNumber}`,
  columns: { greenskeeper: ['Raked by hand'], operator: ['Raked by machine'] },
}))

export const EXPECTED_SAMPLE_LAYOUT = [
  {
    title: 'Tee box',
    sections: [
      { title: null, columns: { greenskeeper: ['Collect garbage'], operator: [] } },
      { title: 'Tee box', columns: { greenskeeper: ['Cleared'], operator: ['Mowed'] } },
      { title: 'Par 3 tee box', columns: { greenskeeper: ['Cleared'], operator: ['Mowed'] } },
    ],
  },
  {
    title: 'Fairway',
    sections: [
      {
        title: null,
        columns: { greenskeeper: ['Cart signs'], operator: ['Fairway mowed', 'Fairway sprayed'] },
      },
    ],
  },
  { title: 'Rough', sections: [{ title: null, columns: { greenskeeper: [], operator: ['Rough mowed'] } }] },
  { title: 'Bunkers', sections: BUNKER_SECTIONS },
  {
    title: 'Green',
    sections: [
      {
        title: null,
        columns: {
          greenskeeper: ['Pin placement', 'Ball marks', 'Top dress'],
          operator: ['Mowed', 'Rolled', 'Sprayed'],
        },
      },
    ],
  },
]

// Tasks for five different roles, arriving in an order that is not the order of the columns
export const COLUMN_ORDER_ITEMS = [
  makeChecklistItem({ id: 'mechanic-task', allowedJobTitles: ['mechanic'] }),
  makeChecklistItem({ id: 'operator-task', allowedJobTitles: ['operator'] }),
  makeChecklistItem({ id: 'greenskeeper-task', allowedJobTitles: ['greenskeeper'] }),
  makeChecklistItem({ id: 'nobody-task', allowedJobTitles: [] }),
  makeChecklistItem({ id: 'landscaper-task', allowedJobTitles: ['landscaper'] }),
]
// Greenskeeper and operator lead, the others follow as they arrived, and "Other" is last
export const EXPECTED_COLUMN_ORDER = ['greenskeeper', 'operator', 'mechanic', 'landscaper', 'other']

// A task that several roles may check sits in the column of the first one it names
export const SEVERAL_TITLES_ITEMS = [
  makeChecklistItem({ id: 'shared', allowedJobTitles: ['operator', 'greenskeeper'] }),
  makeChecklistItem({ id: 'solo', allowedJobTitles: ['greenskeeper'] }),
]

// Lists of job titles that do not name a role properly, and the column the task lands in
export const ODD_TITLE_LIST_CASES = [
  { label: 'no list at all', allowedJobTitles: undefined, expectedKey: 'other' },
  { label: 'a list that is null', allowedJobTitles: null, expectedKey: 'other' },
  { label: 'a list that is text, not a list', allowedJobTitles: 'operator', expectedKey: 'other' },
  { label: 'an empty list', allowedJobTitles: [], expectedKey: 'other' },
  { label: 'a list holding only null', allowedJobTitles: [null], expectedKey: 'other' },
  { label: 'a list holding only an empty string', allowedJobTitles: [''], expectedKey: 'other' },
  { label: 'a list that starts with a null', allowedJobTitles: [null, 'operator'], expectedKey: 'operator' },
]

// Known job titles are written as their labels, unknown ones as they are, and "Other" as Other.
// "constructor" is a name every object has, which must not be mistaken for a job title.
export const TITLE_ITEMS = [
  makeChecklistItem({ id: 'landscaper-task', allowedJobTitles: ['landscaper'] }),
  makeChecklistItem({ id: 'smuggler-task', allowedJobTitles: ['smuggler'] }),
  makeChecklistItem({ id: 'constructor-task', allowedJobTitles: ['constructor'] }),
  makeChecklistItem({ id: 'nobody-task', allowedJobTitles: [] }),
]
export const EXPECTED_TITLES = ['Landscaper', 'smuggler', 'constructor', 'Other']

// A club with a single role gets a single column
export const ONE_ROLE_ITEMS = [
  makeChecklistItem({ id: 'first', allowedJobTitles: ['operator'] }),
  makeChecklistItem({ id: 'second', allowedJobTitles: ['operator'] }),
]