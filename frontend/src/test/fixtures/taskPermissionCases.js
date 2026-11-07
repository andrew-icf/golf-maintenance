// People, as /me describes them
export const YODA = { id: 'user-yoda', full_name: 'Yoda', role: 'staff', job_title: 'greenskeeper' }
export const LUKE = { id: 'user-luke', full_name: 'Luke Skywalker', role: 'staff', job_title: 'operator' }
export const AHSOKA = { id: 'user-ahsoka', full_name: 'Ahsoka Tano', role: 'staff', job_title: 'landscaper' }
export const ANAKIN = { id: 'user-anakin', full_name: 'Anakin Skywalker', role: 'staff', job_title: 'mechanic' }
export const JYN = { id: 'user-jyn', full_name: 'Jyn Erso', role: 'staff', job_title: 'office_admin' }
export const MON_MOTHMA = { id: 'user-mon', full_name: 'Mon Mothma', role: 'admin', job_title: 'superintendent' }
export const LEIA = { id: 'user-leia', full_name: 'Leia Organa', role: 'admin', job_title: 'assistant_superintendent' }
export const OBI_WAN = { id: 'user-obi', full_name: 'Obi-Wan Kenobi', role: 'admin', job_title: 'master_mechanic' }

// Tasks, each naming who may check it. The key is only for the tests to point at one.
export const GREENSKEEPER_TASK = { key: 'greenskeeper', allowedJobTitles: ['greenskeeper'] }
export const OPERATOR_TASK = { key: 'operator', allowedJobTitles: ['operator'] }
export const LANDSCAPER_TASK = { key: 'landscaper', allowedJobTitles: ['landscaper'] }
export const SHARED_TASK = { key: 'shared', allowedJobTitles: ['greenskeeper', 'operator'] }
export const NOBODY_TASK = { key: 'nobody', allowedJobTitles: [] }
export const ALL_TASKS = [GREENSKEEPER_TASK, OPERATOR_TASK, LANDSCAPER_TASK, SHARED_TASK, NOBODY_TASK]

const EVERY_TASK = ALL_TASKS.map((task) => task.key)

// Each person with exactly the tasks they may check, written out by hand
export const PEOPLE_AND_THEIR_TASKS = [
  { name: 'Yoda, a greenskeeper', user: YODA, mayCheck: ['greenskeeper', 'shared'] },
  { name: 'Luke, an operator', user: LUKE, mayCheck: ['operator', 'shared'] },
  { name: 'Ahsoka, a landscaper', user: AHSOKA, mayCheck: ['landscaper'] },
  { name: 'Anakin, a mechanic', user: ANAKIN, mayCheck: [] },
  { name: 'Jyn, an office admin', user: JYN, mayCheck: [] },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, mayCheck: EVERY_TASK },
  { name: 'Leia, an assistant superintendent', user: LEIA, mayCheck: EVERY_TASK },
  { name: 'Obi-Wan, a master mechanic', user: OBI_WAN, mayCheck: EVERY_TASK },
]

export const NO_PERSON_CASES = [
  { label: 'null', user: null },
  { label: 'undefined', user: undefined },
]

export const NO_TASK_CASES = [
  { label: 'null', task: null },
  { label: 'undefined', task: undefined },
]

// People who are not quite what the server sends
export const ODD_PEOPLE_CASES = [
  { label: 'staff with no job title', user: { role: 'staff', job_title: null }, task: OPERATOR_TASK, expected: false },
  { label: 'staff with an empty job title', user: { role: 'staff', job_title: '' }, task: OPERATOR_TASK, expected: false },
  { label: 'staff with no job title field', user: { role: 'staff' }, task: OPERATOR_TASK, expected: false },
  {
    label: 'a title spelled with a capital',
    user: { role: 'staff', job_title: 'Operator' },
    task: OPERATOR_TASK,
    expected: false,
  },
  {
    label: 'a title with a trailing space',
    user: { role: 'staff', job_title: 'operator ' },
    task: OPERATOR_TASK,
    expected: false,
  },
  {
    label: 'a role spelled "Admin", which the server does not accept, and no title',
    user: { role: 'Admin', job_title: null },
    task: OPERATOR_TASK,
    expected: false,
  },
  {
    label: 'a role spelled "Admin" with the right title',
    user: { role: 'Admin', job_title: 'operator' },
    task: OPERATOR_TASK,
    expected: true,
  },
  { label: 'an admin with no job title', user: { role: 'admin' }, task: GREENSKEEPER_TASK, expected: true },
  { label: 'a person with no role and the right title', user: { job_title: 'operator' }, task: OPERATOR_TASK, expected: true },
  { label: 'a person with no role and no title', user: {}, task: OPERATOR_TASK, expected: false },
  {
    label: 'a list that holds nothing but nulls, for someone with no title',
    user: { role: 'staff', job_title: null },
    task: { allowedJobTitles: [null, undefined] },
    expected: false,
  },
]

// Tasks that do not name who may check them properly, so only admins may
export const ODD_TASK_CASES = [
  { label: 'a task with no list of titles', task: {} },
  { label: 'a task whose list is null', task: { allowedJobTitles: null } },
  { label: 'a task whose list is text, not a list', task: { allowedJobTitles: 'operator' } },
  { label: 'a task whose list is an object', task: { allowedJobTitles: { 0: 'operator' } } },
  { label: 'a task whose list is empty', task: { allowedJobTitles: [] } },
]

// Frozen, so any attempt to change them in place throws
export const FROZEN_USER = Object.freeze({ ...LUKE })
export const FROZEN_TASK = Object.freeze({ key: 'operator', allowedJobTitles: Object.freeze(['operator']) })

// What each task's badge says
export const ALLOWED_TITLES_TEXT_CASES = [
  { label: 'one title', task: { allowedJobTitles: ['greenskeeper'] }, expected: 'Greenskeeper' },
  { label: 'another title', task: { allowedJobTitles: ['operator'] }, expected: 'Operator' },
  { label: 'two titles', task: { allowedJobTitles: ['greenskeeper', 'operator'] }, expected: 'Greenskeeper or Operator' },
  {
    label: 'two titles in the other order',
    task: { allowedJobTitles: ['operator', 'greenskeeper'] },
    expected: 'Operator or Greenskeeper',
  },
  {
    label: 'three titles',
    task: { allowedJobTitles: ['greenskeeper', 'operator', 'landscaper'] },
    expected: 'Greenskeeper, Operator, or Landscaper',
  },
  {
    label: 'four titles',
    task: { allowedJobTitles: ['greenskeeper', 'operator', 'landscaper', 'mechanic'] },
    expected: 'Greenskeeper, Operator, Landscaper, or Mechanic',
  },
  { label: 'a title listed twice', task: { allowedJobTitles: ['operator', 'operator'] }, expected: 'Operator' },
  { label: 'a title it does not recognize', task: { allowedJobTitles: ['smuggler'] }, expected: '' },
  { label: 'an inherited name', task: { allowedJobTitles: ['constructor'] }, expected: '' },
  {
    label: 'a recognized title next to an unknown one',
    task: { allowedJobTitles: ['operator', 'smuggler'] },
    expected: 'Operator',
  },
  { label: 'an empty list', task: { allowedJobTitles: [] }, expected: '' },
  { label: 'no list', task: {}, expected: '' },
  { label: 'a list that is text', task: { allowedJobTitles: 'operator' }, expected: '' },
  { label: 'a list that is null', task: { allowedJobTitles: null }, expected: '' },
]