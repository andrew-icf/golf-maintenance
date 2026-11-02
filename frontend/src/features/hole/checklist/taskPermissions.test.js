import { describe, expect, it } from 'vitest'
import {
  ALL_TASKS,
  ALLOWED_TITLES_TEXT_CASES,
  FROZEN_TASK,
  FROZEN_USER,
  LUKE,
  MON_MOTHMA,
  NO_PERSON_CASES,
  NO_TASK_CASES,
  ODD_PEOPLE_CASES,
  ODD_TASK_CASES,
  PEOPLE_AND_THEIR_TASKS,
} from '../../../test/fixtures/taskPermissionCases'
import { canCheckTask, formatAllowedTitles } from './taskPermissions'

describe('canCheckTask', () => {
  it.each(PEOPLE_AND_THEIR_TASKS)('lets $name check exactly the tasks they should', ({ user, mayCheck }) => {
    for (const task of ALL_TASKS) {
      expect(canCheckTask(user, task), `${task.key} task`).toBe(mayCheck.includes(task.key))
    }
  })

  it.each(NO_PERSON_CASES)('lets nobody check anything when the person is $label', ({ user }) => {
    for (const task of ALL_TASKS) {
      expect(canCheckTask(user, task), `${task.key} task`).toBe(false)
    }
  })

  it.each(NO_TASK_CASES)('lets nobody check a task that is $label, not even an admin', ({ task }) => {
    expect(canCheckTask(LUKE, task)).toBe(false)
    expect(canCheckTask(MON_MOTHMA, task)).toBe(false)
  })

  it.each(ODD_PEOPLE_CASES)('says $expected for $label', ({ user, task, expected }) => {
    expect(canCheckTask(user, task)).toBe(expected)
  })

  it.each(ODD_TASK_CASES)('leaves $label to admins alone', ({ task }) => {
    expect(canCheckTask(LUKE, task)).toBe(false)
    expect(canCheckTask(MON_MOTHMA, task)).toBe(true)
  })

  it('does not modify the person or the task it is given', () => {
    expect(() => canCheckTask(FROZEN_USER, FROZEN_TASK)).not.toThrow()
    expect(canCheckTask(FROZEN_USER, FROZEN_TASK)).toBe(true)
  })
})

describe('formatAllowedTitles', () => {
  it.each(ALLOWED_TITLES_TEXT_CASES)('writes $label as "$expected"', ({ task, expected }) => {
    expect(formatAllowedTitles(task)).toBe(expected)
  })

  it.each(NO_TASK_CASES)('says nothing for a task that is $label', ({ task }) => {
    expect(formatAllowedTitles(task)).toBe('')
  })
})