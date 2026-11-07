import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_ASSIGNMENTS,
  DUTIES,
  EXPECTED_DEDUPED_NAMES,
  EXPECTED_NON_OBJECT_NAMES,
  EXPECTED_ODD_DUTY_ENTRIES,
  EXPECTED_SEVERAL_NAMES,
  FROZEN_DUTIES,
  FROZEN_PEOPLE_ASSIGNMENTS,
  FULL_ASSIGNMENTS,
  FULL_ASSIGNMENT_NAMES,
  NAME_CASES,
  NON_OBJECT_PEOPLE_ASSIGNMENTS,
  NO_ASSIGNMENT_CASES,
  NO_DUTIES_CASES,
  NO_ID_ASSIGNMENTS,
  ODD_DUTIES,
  ODD_LIST_ASSIGNMENTS,
  ODD_LIST_DUTY_KEYS,
  SAMPLE_PEOPLE_BY_DUTY,
  SEVERAL_PEOPLE_ASSIGNMENTS,
  TITLE_CASES,
  UNLISTED_DUTY_ASSIGNMENTS,
  VIEWER_SAMPLE_CASES,
} from '../../../test/fixtures/responsibleTodayCases'
import { LUKE, MON_MOTHMA, NO_PERSON_CASES } from '../../../test/fixtures/taskPermissionCases'
import { buildChecklistItems, listDuties } from './checklistTasks'
import { buildResponsibleList, buildSampleAssignments } from './responsibleList'

// Actions
function entryFor(entries, key) {
  return entries.find((entry) => entry.key === key)
}

function everyoneListed(entries) {
  return entries.flatMap((entry) => entry.people)
}

describe('buildResponsibleList', () => {
  it('lists each duty in order, with the people answerable for it', () => {
    const entries = buildResponsibleList(DUTIES, FULL_ASSIGNMENTS, MON_MOTHMA)

    expect(entries.map((entry) => entry.title)).toEqual(DUTIES.map((duty) => duty.title))
    expect(entries.map((entry) => entry.people.map((person) => person.name))).toEqual(FULL_ASSIGNMENT_NAMES)
  })

  it("marks the viewer's own entry, and only that one", () => {
    const entries = buildResponsibleList(DUTIES, FULL_ASSIGNMENTS, LUKE)

    const yours = everyoneListed(entries).filter((person) => person.isYou)

    expect(yours.map((person) => person.name)).toEqual(['Luke Skywalker'])
  })

  it.each(NO_PERSON_CASES)('marks nobody when the person is $label', ({ user }) => {
    const entries = buildResponsibleList(DUTIES, FULL_ASSIGNMENTS, user)

    expect(everyoneListed(entries).some((person) => person.isYou)).toBe(false)
  })

  it('does not mark someone else who has the same name', () => {
    const someoneElse = { id: 'user-another-luke', full_name: 'Luke Skywalker' }

    const entries = buildResponsibleList(DUTIES, FULL_ASSIGNMENTS, someoneElse)

    expect(everyoneListed(entries).some((person) => person.isYou)).toBe(false)
  })

  it.each(NO_ASSIGNMENT_CASES)('lists nobody when the assignments are $label', ({ assignments }) => {
    const entries = buildResponsibleList(DUTIES, assignments, LUKE)

    expect(entries).toHaveLength(DUTIES.length)
    expect(everyoneListed(entries)).toEqual([])
  })

  it('lists nobody for a duty given an empty list, null, or text in place of people', () => {
    const entries = buildResponsibleList(DUTIES, ODD_LIST_ASSIGNMENTS, LUKE)

    for (const key of ODD_LIST_DUTY_KEYS) {
      expect(entryFor(entries, key).people, key).toEqual([])
    }
  })

  it('lists several people for a duty, in the order given', () => {
    const entries = buildResponsibleList(DUTIES, SEVERAL_PEOPLE_ASSIGNMENTS, MON_MOTHMA)

    expect(entryFor(entries, 'bunkers').people.map((person) => person.name)).toEqual(EXPECTED_SEVERAL_NAMES)
  })

  it('lists a person once when they are listed twice', () => {
    const entries = buildResponsibleList(DUTIES, DUPLICATE_ASSIGNMENTS, MON_MOTHMA)

    expect(entryFor(entries, 'rolling').people.map((person) => person.name)).toEqual(EXPECTED_DEDUPED_NAMES)
  })

  it('keeps every person who has no id, each with a key of their own', () => {
    const entries = buildResponsibleList(DUTIES, NO_ID_ASSIGNMENTS, MON_MOTHMA)
    const people = entryFor(entries, 'rolling').people

    expect(people.map((person) => person.name)).toEqual(['Temp One', 'Temp Two', 'Temp Three'])
    expect(new Set(people.map((person) => person.key)).size).toBe(3)
  })

  it.each(NAME_CASES)('writes a person with $label as "$expected"', ({ person, expected }) => {
    const entries = buildResponsibleList(
      [{ key: 'rolling', title: 'Rolling' }],
      new Map([['rolling', [person]]]),
      MON_MOTHMA
    )

    expect(entries[0].people[0].name).toBe(expected)
  })

  it.each(TITLE_CASES)(
    'gives a person with $label the chip "$expectedLabel" in the $expectedTone color',
    ({ jobTitle, expectedLabel, expectedTone }) => {
      const entries = buildResponsibleList(
        [{ key: 'rolling', title: 'Rolling' }],
        new Map([['rolling', [{ id: 'p1', name: 'Someone', jobTitle }]]]),
        MON_MOTHMA
      )

      expect(entries[0].people[0].titleLabel).toBe(expectedLabel)
      expect(entries[0].people[0].tone).toBe(expectedTone)
    }
  )

  it('ignores assignments for a duty that is not on the list', () => {
    const entries = buildResponsibleList(DUTIES, UNLISTED_DUTY_ASSIGNMENTS, MON_MOTHMA)

    expect(entries.map((entry) => entry.key)).toEqual(DUTIES.map((duty) => duty.key))
    expect(everyoneListed(entries)).toEqual([])
  })

  it.each(NO_DUTIES_CASES)('lists nothing when the duties are $label', ({ duties }) => {
    expect(buildResponsibleList(duties, FULL_ASSIGNMENTS, LUKE)).toEqual([])
  })

  it('skips duties with no key, and uses the key as the title when a duty has none', () => {
    expect(buildResponsibleList(ODD_DUTIES, new Map(), LUKE)).toEqual(EXPECTED_ODD_DUTY_ENTRIES)
  })

  it('skips people that are not objects', () => {
    const entries = buildResponsibleList(DUTIES, NON_OBJECT_PEOPLE_ASSIGNMENTS, MON_MOTHMA)

    expect(entryFor(entries, 'rolling').people.map((person) => person.name)).toEqual(EXPECTED_NON_OBJECT_NAMES)
  })

  it('does not modify what it is given', () => {
    expect(() => buildResponsibleList(FROZEN_DUTIES, FROZEN_PEOPLE_ASSIGNMENTS, LUKE)).not.toThrow()
    expect(FROZEN_PEOPLE_ASSIGNMENTS.get('rolling')).toHaveLength(1)
  })

})

describe('buildSampleAssignments', () => {
  it('gives every duty on the sample checklist exactly one person', () => {
    const assignments = buildSampleAssignments(null)
    const dutyKeys = listDuties(buildChecklistItems()).map((duty) => duty.key)

    expect([...assignments.keys()]).toEqual(dutyKeys)
    for (const [key, people] of assignments) {
      expect(people, key).toHaveLength(1)
    }
  })

  it.each(VIEWER_SAMPLE_CASES)('puts $name in the right duty, if any', ({ user, replacedDuty }) => {
    const assignments = buildSampleAssignments(user)

    for (const duty of DUTIES) {
      const [person] = assignments.get(duty.key)

      if (duty.key === replacedDuty) {
        expect(person, duty.key).toMatchObject({ id: user.id, name: user.full_name, jobTitle: user.job_title })
      } else {
        expect(person.name, duty.key).toBe(SAMPLE_PEOPLE_BY_DUTY[duty.key])
      }
    }
  })

  it('gives every sample person an id that starts with sample-', () => {
    const assignments = buildSampleAssignments(null)

    for (const [key, [person]] of assignments) {
      expect(person.id.startsWith('sample-'), key).toBe(true)
    }
  })
})