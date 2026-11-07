import { formatJobTitle } from '../../../constants/jobTitles'

const KNOWN_TONES = ['greenskeeper', 'operator']

// A greenskeeper chip is green, an operator chip amber, and any other role gets a neutral one
function toneOf(jobTitle) {
  return KNOWN_TONES.includes(jobTitle) ? jobTitle : 'other'
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function hasId(person) {
  return typeof person.id === 'string' && person.id !== ''
}

function describePerson(person, user, index) {
  const name = typeof person.name === 'string' && person.name.trim() !== '' ? person.name.trim() : 'Someone'
  const jobTitle = typeof person.jobTitle === 'string' ? person.jobTitle : null

  return {
    key: hasId(person) ? person.id : `unnamed-${index}`,
    name,
    // Matched by id, never by name, so a different person with the same name is not "you"
    isYou: hasId(person) && Boolean(user?.id) && person.id === user.id,
    titleLabel: jobTitle ? formatJobTitle(jobTitle) : '',
    tone: toneOf(jobTitle),
  }
}

// The people assigned to one duty: each person once, and nothing that is not a person
function peopleFor(dutyKey, assignments, user) {
  const assigned = assignments instanceof Map ? assignments.get(dutyKey) : undefined
  if (!Array.isArray(assigned)) {
    return []
  }

  const seenIds = new Set()
  const people = []

  assigned.forEach((person, index) => {
    if (!isObject(person)) {
      return
    }
    if (hasId(person)) {
      if (seenIds.has(person.id)) {
        return
      }
      seenIds.add(person.id)
    }
    people.push(describePerson(person, user, index))
  })

  return people
}

// The "Responsible today" list: each duty in the order given, with the people answerable for it.
// assignments is a Map from a duty's key to a list of people, each { id, name, jobTitle }. A duty
// nobody has is listed with no people, and a duty with no key is skipped.
export function buildResponsibleList(duties, assignments, user) {
  if (!Array.isArray(duties)) {
    return []
  }

  return duties
    .filter((duty) => isObject(duty) && typeof duty.key === 'string' && duty.key !== '')
    .map((duty) => ({
      key: duty.key,
      title: typeof duty.title === 'string' && duty.title ? duty.title : duty.key,
      people: peopleFor(duty.key, assignments, user),
    }))
}

// The people the preview names for each duty. Their ids start with "sample-", so none of them can
// ever be mistaken for the person looking.
const SAMPLE_PEOPLE = [
  ['greenskeeper', { id: 'sample-yoda', name: 'Yoda', jobTitle: 'greenskeeper' }],
  ['bunkers', { id: 'sample-chewbacca', name: 'Chewbacca', jobTitle: 'operator' }],
  ['greens', { id: 'sample-wedge', name: 'Wedge Antilles', jobTitle: 'operator' }],
  ['rolling', { id: 'sample-han', name: 'Han Solo', jobTitle: 'operator' }],
  ['spraying', { id: 'sample-din', name: 'Din Djarin', jobTitle: 'operator' }],
  ['rough', { id: 'sample-lando', name: 'Lando Calrissian', jobTitle: 'operator' }],
  ['tees_and_fairways', { id: 'sample-finn', name: 'Finn', jobTitle: 'operator' }],
]

// The one duty the person looking takes in the preview, by job title, so they can see how "(you)"
// reads. Everyone else, such as an admin, takes none.
const DUTY_FOR_JOB_TITLE = new Map([
  ['greenskeeper', 'greenskeeper'],
  ['operator', 'greens'],
])

export function buildSampleAssignments(user) {
  const viewerDuty = user?.id ? DUTY_FOR_JOB_TITLE.get(user.job_title) : undefined

  return new Map(
    SAMPLE_PEOPLE.map(([duty, person]) => [
      duty,
      [duty === viewerDuty ? { id: user.id, name: user.full_name, jobTitle: user.job_title } : { ...person }],
    ])
  )
}