import { describe, expect, it } from 'vitest'
import { formatDateString } from '../../schedule/scheduleDates'
import {
  DESCRIBE_MARK_CASES,
  FORMAT_TIME_CASES,
  HAN_SOLO,
  INVALID_TIME_CASES,
  NOW,
  SAMPLE_DAY,
  SAMPLE_MARK_DESCRIPTIONS,
  atTime,
  doneMark,
  notTodayMark,
  NO_ITEMS_CASES,
} from '../../../test/fixtures/checklistCases'
import {
  ALL_TASKS,
  LUKE,
  MON_MOTHMA,
  NO_PERSON_CASES,
  PEOPLE_AND_THEIR_TASKS,
  YODA,
} from '../../../test/fixtures/taskPermissionCases'
import { buildChecklistItems } from './checklistTasks'
import {
  buildSampleMarks,
  checkItem,
  describeMark,
  formatMarkTime,
  skipItem,
  statusOf,
  summarizeProgress,
  undoItem,
} from './checklistMarks'

// Test data
const ITEMS = buildChecklistItems()
const GREENSKEEPER_ITEM = ITEMS.find((item) => item.id === 't-boxes-cleared')
const OPERATOR_ITEM = ITEMS.find((item) => item.id === 't-boxes-mowed')
const OTHER_OPERATOR_ITEM = ITEMS.find((item) => item.id === 'rough-mowed')

// Actions
function withMarks(entries) {
  return new Map(entries)
}

describe('checkItem', () => {
  it.each(PEOPLE_AND_THEIR_TASKS)('lets $name check exactly the tasks they may', ({ user, mayCheck }) => {
    for (const task of ALL_TASKS) {
      const item = { ...task, id: task.key }
      const marks = new Map()

      const result = checkItem(marks, item, user, NOW)

      expect(result.has(item.id), `${task.key} task`).toBe(mayCheck.includes(task.key))
      if (!mayCheck.includes(task.key)) {
        expect(result, `${task.key} task`).toBe(marks)
      }
    }
  })

  it('records who checked it, and when', () => {
    const result = checkItem(new Map(), OPERATOR_ITEM, LUKE, NOW)

    expect(result.get(OPERATOR_ITEM.id)).toEqual({
      status: 'done',
      byId: LUKE.id,
      byName: 'Luke Skywalker',
      at: NOW,
    })
  })

  it('leaves a task that is already done alone, whoever tries', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(HAN_SOLO.id, 'Han Solo', atTime(5, 0))]])

    const result = checkItem(marks, OPERATOR_ITEM, LUKE, NOW)

    expect(result).toBe(marks)
    expect(result.get(OPERATOR_ITEM.id).byId).toBe(HAN_SOLO.id)
  })

  it('leaves a task that was set aside for today alone', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, notTodayMark(HAN_SOLO.id, 'Han Solo', atTime(5, 0))]])

    expect(checkItem(marks, OPERATOR_ITEM, LUKE, NOW)).toBe(marks)
  })

  it('does not change the marks it is given', () => {
    const marks = new Map()

    const result = checkItem(marks, OPERATOR_ITEM, LUKE, NOW)

    expect(result).not.toBe(marks)
    expect(marks.size).toBe(0)
  })

  it.each([
    { label: 'null', marks: null },
    { label: 'undefined', marks: undefined },
  ])('starts a new set of marks when there are $label yet', ({ marks }) => {
    const result = checkItem(marks, OPERATOR_ITEM, LUKE, NOW)

    expect(result.size).toBe(1)
    expect(statusOf(result, OPERATOR_ITEM.id)).toBe('done')
  })

  it.each(NO_PERSON_CASES)('checks nothing when the person is $label', ({ user }) => {
    const marks = new Map()

    expect(checkItem(marks, OPERATOR_ITEM, user, NOW)).toBe(marks)
  })

  it('checks nothing when there is no task', () => {
    const marks = new Map()

    expect(checkItem(marks, null, MON_MOTHMA, NOW)).toBe(marks)
  })
})

describe('skipItem', () => {
  it('sets a task aside for today, recording who and when', () => {
    const result = skipItem(new Map(), OPERATOR_ITEM, LUKE, NOW)

    expect(result.get(OPERATOR_ITEM.id)).toEqual({
      status: 'not_today',
      byId: LUKE.id,
      byName: 'Luke Skywalker',
      at: NOW,
    })
  })

  it('does nothing for someone who may not check the task', () => {
    const marks = new Map()

    expect(skipItem(marks, GREENSKEEPER_ITEM, LUKE, NOW)).toBe(marks)
  })

  it('leaves a task that is done as it is', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(HAN_SOLO.id, 'Han Solo', atTime(5, 0))]])

    expect(skipItem(marks, OPERATOR_ITEM, LUKE, NOW)).toBe(marks)
  })

  it('leaves a task that is already set aside as it is', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, notTodayMark(HAN_SOLO.id, 'Han Solo', atTime(5, 0))]])

    expect(skipItem(marks, OPERATOR_ITEM, LUKE, NOW)).toBe(marks)
  })
})

describe('undoItem', () => {
  it('takes back a check', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)]])

    const result = undoItem(marks, OPERATOR_ITEM, LUKE)

    expect(statusOf(result, OPERATOR_ITEM.id)).toBe('open')
  })

  it('takes back a "not today"', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, notTodayMark(LUKE.id, 'Luke Skywalker', NOW)]])

    const result = undoItem(marks, OPERATOR_ITEM, LUKE)

    expect(statusOf(result, OPERATOR_ITEM.id)).toBe('open')
  })

  it('leaves an open task alone', () => {
    const marks = new Map()

    expect(undoItem(marks, OPERATOR_ITEM, LUKE)).toBe(marks)
  })

  it("does not let someone who may not check the task take back another person's check", () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)]])

    const result = undoItem(marks, OPERATOR_ITEM, YODA)

    expect(result).toBe(marks)
    expect(statusOf(result, OPERATOR_ITEM.id)).toBe('done')
  })

  it("lets anyone who may check the task take back someone else's check", () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)]])

    const result = undoItem(marks, OPERATOR_ITEM, HAN_SOLO)

    expect(statusOf(result, OPERATOR_ITEM.id)).toBe('open')
  })

  it("lets an admin take back anyone's check", () => {
    const marks = withMarks([[GREENSKEEPER_ITEM.id, doneMark(YODA.id, 'Yoda', NOW)]])

    const result = undoItem(marks, GREENSKEEPER_ITEM, MON_MOTHMA)

    expect(statusOf(result, GREENSKEEPER_ITEM.id)).toBe('open')
  })

  it('takes back only that task and keeps every other mark', () => {
    const marks = withMarks([
      [OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)],
      [OTHER_OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)],
    ])

    const result = undoItem(marks, OPERATOR_ITEM, LUKE)

    expect(result.size).toBe(1)
    expect(statusOf(result, OTHER_OPERATOR_ITEM.id)).toBe('done')
  })

  it('does not change the marks it is given', () => {
    const marks = withMarks([[OPERATOR_ITEM.id, doneMark(LUKE.id, 'Luke Skywalker', NOW)]])

    undoItem(marks, OPERATOR_ITEM, LUKE)

    expect(marks.size).toBe(1)
  })
})

describe('statusOf', () => {
  it.each([
    { label: 'no mark', marks: new Map(), expected: 'open' },
    {
      label: 'a check',
      marks: withMarks([['task', doneMark('user-1', 'Someone', NOW)]]),
      expected: 'done',
    },
    {
      label: 'a "not today"',
      marks: withMarks([['task', notTodayMark('user-1', 'Someone', NOW)]]),
      expected: 'not_today',
    },
    { label: 'no marks at all', marks: null, expected: 'open' },
  ])('says $expected for $label', ({ marks, expected }) => {
    expect(statusOf(marks, 'task')).toBe(expected)
  })
})

describe('summarizeProgress', () => {
  it('counts the sample marks against the full checklist', () => {
    const summary = summarizeProgress(ITEMS, buildSampleMarks(SAMPLE_DAY))

    expect(summary).toEqual({
      total: 20,
      done: 5,
      notToday: 3,
      accountedFor: 8,
      open: 12,
      isComplete: false,
    })
  })

  it('has nothing done when nothing is marked', () => {
    expect(summarizeProgress(ITEMS, new Map())).toEqual({
      total: 20,
      done: 0,
      notToday: 0,
      accountedFor: 0,
      open: 20,
      isComplete: false,
    })
  })

  it('is complete when every task is done or set aside', () => {
    const marks = new Map(
      ITEMS.map((item, index) => [
        item.id,
        index % 2 === 0 ? doneMark('user-1', 'Someone', NOW) : notTodayMark('user-1', 'Someone', NOW),
      ])
    )

    const summary = summarizeProgress(ITEMS, marks)

    expect(summary.isComplete).toBe(true)
    expect(summary.open).toBe(0)
    expect(summary.accountedFor).toBe(20)
  })

  it('is not complete while a single task is still open', () => {
    const marks = new Map(ITEMS.slice(1).map((item) => [item.id, doneMark('user-1', 'Someone', NOW)]))

    const summary = summarizeProgress(ITEMS, marks)

    expect(summary.isComplete).toBe(false)
    expect(summary.open).toBe(1)
  })

  it.each(NO_ITEMS_CASES)('has no tasks, and is not complete, for $label', ({ items }) => {
    expect(summarizeProgress(items, new Map())).toEqual({
      total: 0,
      done: 0,
      notToday: 0,
      accountedFor: 0,
      open: 0,
      isComplete: false,
    })
  })

  it('ignores marks on tasks that are not on the list', () => {
    const marks = new Map([['ghost-task', doneMark('user-1', 'Someone', NOW)]])

    const summary = summarizeProgress(ITEMS, marks)

    expect(summary.done).toBe(0)
    expect(summary.open).toBe(20)
  })

  it('counts a task set aside for today as accounted for', () => {
    const marks = new Map(ITEMS.map((item) => [item.id, notTodayMark('user-1', 'Someone', NOW)]))

    const summary = summarizeProgress(ITEMS, marks)

    expect(summary.notToday).toBe(20)
    expect(summary.isComplete).toBe(true)
  })
})

describe('describeMark', () => {
  it.each(DESCRIBE_MARK_CASES)('says "$expected" for $label', ({ mark, user, expected }) => {
    expect(describeMark(mark, user)).toBe(expected)
  })
})

describe('formatMarkTime', () => {
  it.each(FORMAT_TIME_CASES)('writes $label as $expected', ({ hours, minutes, expected }) => {
    expect(formatMarkTime(atTime(hours, minutes))).toBe(expected)
  })

  it.each(INVALID_TIME_CASES)('says nothing for a time that is $label', ({ atMs }) => {
    expect(formatMarkTime(atMs)).toBe('')
  })
})

describe('buildSampleMarks', () => {
  it('only marks tasks that are on the sample checklist', () => {
    const itemIds = new Set(ITEMS.map((item) => item.id))

    for (const taskId of buildSampleMarks(SAMPLE_DAY).keys()) {
      expect(itemIds.has(taskId), taskId).toBe(true)
    }
  })

  it('has five tasks done and three set aside', () => {
    const marks = buildSampleMarks(SAMPLE_DAY)
    const statuses = [...marks.values()].map((mark) => mark.status)

    expect(statuses.filter((status) => status === 'done')).toHaveLength(5)
    expect(statuses.filter((status) => status === 'not_today')).toHaveLength(3)
  })

  it.each(SAMPLE_MARK_DESCRIPTIONS)('says "$expected" under $id', ({ id, expected }) => {
    const marks = buildSampleMarks(SAMPLE_DAY)

    expect(describeMark(marks.get(id), LUKE)).toBe(expected)
  })

  it('is never mistaken for the person looking', () => {
    for (const [taskId, mark] of buildSampleMarks(SAMPLE_DAY)) {
      expect(mark.byId.startsWith('sample-'), taskId).toBe(true)
      expect(describeMark(mark, LUKE), taskId).not.toMatch(/^You/)
    }
  })

  it('puts the times on the day it is given', () => {
    for (const day of [SAMPLE_DAY, '2026-12-31']) {
      for (const [taskId, mark] of buildSampleMarks(day)) {
        expect(formatDateString(new Date(mark.at)), taskId).toBe(day)
      }
    }
  })
})