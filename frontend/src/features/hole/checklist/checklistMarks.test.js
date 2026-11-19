import { describe, expect, it } from 'vitest'
import {
  DESCRIBE_MARK_CASES,
  FORMAT_TIME_CASES,
  INVALID_TIME_CASES,
  NOW,
  NO_ITEMS_CASES,
  SAMPLE_DAY,
  atTime,
  doneMark,
  notTodayMark,
} from '../../../test/fixtures/checklistCases'
import { buildSampleItems } from '../../../test/fixtures/holeTaskCases'
import { buildSampleMarks } from '../../../test/fixtures/sampleMarks'
import {
  FROZEN_SERVER_MARKS,
  ITEMS_WITHOUT_IDS,
  MARKED_AT,
  NOT_A_MARK_CASES,
  NOT_A_MARK_LIST_CASES,
  SERVER_ITEMS,
  UNKNOWN_STATUS_CASES,
  UNMATCHED_MARK_CASES,
  UNREADABLE_TIME_CASES,
  makeServerMark,
} from '../../../test/fixtures/serverMarkCases'
import { LUKE } from '../../../test/fixtures/taskPermissionCases'
import {
  describeMark,
  formatClubDate,
  formatMarkTime,
  marksFromServer,
  statusOf,
  summarizeProgress,
} from './checklistMarks'

// Test data
const ITEMS = buildSampleItems()
const ITEM_COUNT = 21

describe('statusOf', () => {
  it.each([
    { label: 'no mark', marks: new Map(), expected: 'open' },
    {
      label: 'a check',
      marks: new Map([['task', doneMark('user-1', 'Someone', NOW)]]),
      expected: 'done',
    },
    {
      label: 'a "not today"',
      marks: new Map([['task', notTodayMark('user-1', 'Someone', NOW)]]),
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
      total: ITEM_COUNT,
      done: 5,
      notToday: 3,
      accountedFor: 8,
      open: 13,
      isComplete: false,
    })
  })

  it('has nothing done when nothing is marked', () => {
    expect(summarizeProgress(ITEMS, new Map())).toEqual({
      total: ITEM_COUNT,
      done: 0,
      notToday: 0,
      accountedFor: 0,
      open: ITEM_COUNT,
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
    expect(summary.accountedFor).toBe(ITEM_COUNT)
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
    expect(summary.open).toBe(ITEM_COUNT)
  })

  it('counts a task set aside for today as accounted for', () => {
    const marks = new Map(ITEMS.map((item) => [item.id, notTodayMark('user-1', 'Someone', NOW)]))

    const summary = summarizeProgress(ITEMS, marks)

    expect(summary.notToday).toBe(ITEM_COUNT)
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

describe('marksFromServer', () => {
  it('turns a done mark into what the checklist reads, keyed by the task on this page', () => {
    const serverMark = makeServerMark('tee-box-mowed', {
      user_id: LUKE.id,
      user_name: 'Luke Skywalker',
      marked_at: MARKED_AT,
    })

    const marks = marksFromServer(SERVER_ITEMS, [serverMark])

    expect([...marks.keys()]).toEqual(['tee-box-mowed'])
    expect(marks.get('tee-box-mowed')).toEqual({
      status: 'done',
      byId: LUKE.id,
      byName: 'Luke Skywalker',
      at: Date.parse(MARKED_AT),
    })
  })

  it('turns a not-today mark into one', () => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('green-rolled', { status: 'not_today' })])

    expect(marks.get('green-rolled').status).toBe('not_today')
  })

  it('puts each mark on its own task, and a bunker mark on its own bunker', () => {
    const marks = marksFromServer(SERVER_ITEMS, [
      makeServerMark('bunker-raked-machine:1'),
      makeServerMark('bunker-raked-machine:2', { user_id: 'user-han', user_name: 'Han Solo' }),
      makeServerMark('tee-box-cleared'),
    ])

    expect([...marks.keys()].sort()).toEqual(['bunker-raked-machine:1', 'bunker-raked-machine:2', 'tee-box-cleared'])
    expect(marks.get('bunker-raked-machine:1').byName).toBe('Yoda')
    expect(marks.get('bunker-raked-machine:2').byName).toBe('Han Solo')
  })

  it.each(UNMATCHED_MARK_CASES)('leaves out a mark naming $label', ({ overrides }) => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('tee-box-mowed', overrides)])

    expect(marks.size).toBe(0)
  })

  it.each(UNKNOWN_STATUS_CASES)('leaves out a mark with $label', ({ overrides }) => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('tee-box-mowed', overrides)])

    expect(marks.size).toBe(0)
  })

  it.each(NOT_A_MARK_CASES)('skips an entry that is $label and keeps the real marks', ({ entry }) => {
    const marks = marksFromServer(SERVER_ITEMS, [entry, makeServerMark('tee-box-mowed')])

    expect([...marks.keys()]).toEqual(['tee-box-mowed'])
  })

  it.each(NOT_A_MARK_LIST_CASES)('gives no marks when the marks are $label', ({ serverMarks }) => {
    const marks = marksFromServer(SERVER_ITEMS, serverMarks)

    expect(marks).toBeInstanceOf(Map)
    expect(marks.size).toBe(0)
  })

  it.each(NO_ITEMS_CASES)('gives no marks when the checklist is $label', ({ items }) => {
    const marks = marksFromServer(items, [makeServerMark('tee-box-mowed')])

    expect(marks.size).toBe(0)
  })

  it('never matches a task that has no ids, even to a mark with no ids', () => {
    const marks = marksFromServer(ITEMS_WITHOUT_IDS, [
      { status: 'done', user_id: 'user-yoda', user_name: 'Yoda', marked_at: MARKED_AT },
    ])

    expect(marks.size).toBe(0)
  })

  it.each(UNREADABLE_TIME_CASES)('keeps a mark whose time is $label, with no time', ({ overrides }) => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('tee-box-mowed', overrides)])

    expect(Number.isNaN(marks.get('tee-box-mowed').at)).toBe(true)
    expect(describeMark(marks.get('tee-box-mowed'), LUKE)).toBe('Yoda')
  })

  it('keeps a mark with no name, with an empty name', () => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('tee-box-mowed', { user_name: undefined })])

    expect(marks.get('tee-box-mowed').byName).toBe('')
  })

  it('keeps a mark with no person id, with an empty id', () => {
    const marks = marksFromServer(SERVER_ITEMS, [makeServerMark('tee-box-mowed', { user_id: undefined })])

    expect(marks.get('tee-box-mowed').byId).toBe('')
  })

  it('counts the first mark when the same task is marked twice', () => {
    const marks = marksFromServer(SERVER_ITEMS, [
      makeServerMark('tee-box-mowed', { user_name: 'First' }),
      makeServerMark('tee-box-mowed', { user_name: 'Second' }),
    ])

    expect(marks.size).toBe(1)
    expect(marks.get('tee-box-mowed').byName).toBe('First')
  })

  it('does not modify the marks it is given', () => {
    expect(() => marksFromServer(SERVER_ITEMS, FROZEN_SERVER_MARKS)).not.toThrow()
    expect(FROZEN_SERVER_MARKS).toHaveLength(1)
  })

  it('gives marks the page can describe, telling the person which are their own', () => {
    const marks = marksFromServer(SERVER_ITEMS, [
      makeServerMark('tee-box-mowed', { user_id: LUKE.id, user_name: 'Luke Skywalker', marked_at: MARKED_AT }),
      makeServerMark('rough-mowed'),
    ])

    expect(describeMark(marks.get('tee-box-mowed'), LUKE)).toBe('You · 6:12am')
    expect(describeMark(marks.get('rough-mowed'), LUKE)).toBe('Yoda · 5:48am')
  })

  it('gives marks the progress count can use', () => {
    const marks = marksFromServer(SERVER_ITEMS, [
      makeServerMark('tee-box-mowed'),
      makeServerMark('rough-mowed'),
      makeServerMark('green-rolled', { status: 'not_today' }),
    ])

    expect(summarizeProgress(SERVER_ITEMS, marks)).toEqual({
      total: 21,
      done: 2,
      notToday: 1,
      accountedFor: 3,
      open: 18,
      isComplete: false,
    })
  })
})

describe('formatClubDate', () => {
  const READABLE_CASES = [
    { label: 'an ordinary day', day: '2026-11-17', expected: 'Tuesday, November 17' },
    { label: 'the last day of the year', day: '2026-12-31', expected: 'Thursday, December 31' },
    { label: 'the first day of the year', day: '2027-01-01', expected: 'Friday, January 1' },
    { label: 'a leap day', day: '2028-02-29', expected: 'Tuesday, February 29' },
  ]
  const UNREADABLE_CASES = [
    { label: 'text that is not a date', day: 'banana' },
    { label: 'a day that is not a real one', day: '2026-13-45' },
    { label: 'a day that does not exist', day: '2026-02-30' },
    { label: 'an empty string', day: '' },
    { label: 'nothing', day: undefined },
    { label: 'null', day: null },
    { label: 'a number', day: 20261117 },
  ]

  it.each(READABLE_CASES)('writes $label as "$expected"', ({ day, expected }) => {
    expect(formatClubDate(day)).toBe(expected)
  })

  it.each(UNREADABLE_CASES)('says nothing for $label', ({ day }) => {
    expect(formatClubDate(day)).toBe('')
  })
})