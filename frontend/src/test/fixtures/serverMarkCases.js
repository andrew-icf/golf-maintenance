import { atTime, makeChecklistItem } from './checklistCases'
import { buildSampleItems } from './holeTaskCases'

// Test data for turning the marks the server sends for a hole into what the checklist reads

// The sample hole's checklist, whose items carry the ids of their task and their feature
export const SERVER_ITEMS = buildSampleItems()

// 6:12am in the device's own time, written the way the server writes a time
export const MARKED_AT = new Date(atTime(6, 12)).toISOString()

// A checklist whose items have no task or feature ids, so no server mark can match them
export const ITEMS_WITHOUT_IDS = [makeChecklistItem({ id: 'no-ids' })]

function itemOf(itemId) {
  return SERVER_ITEMS.find((item) => item.id === itemId)
}

// A mark as the server sends it, for the task and feature of one of the sample items. By default it
// is Yoda's check at 5:48am.
export function makeServerMark(itemId, overrides = {}) {
  const item = itemOf(itemId)

  return {
    feature_id: item.featureId,
    task_id: item.taskId,
    status: 'done',
    user_id: 'user-yoda',
    user_name: 'Yoda',
    marked_at: new Date(atTime(5, 48)).toISOString(),
    ...overrides,
  }
}

// Changes to the tee box's "Mowed" mark that make it name something not on the checklist
export const UNMATCHED_MARK_CASES = [
  { label: 'a feature that is not on the checklist', overrides: { feature_id: 'feature-ghost' } },
  { label: 'a task that is not on the checklist', overrides: { task_id: 'task-ghost' } },
  // Both exist, but a green task does not go with the tee box
  { label: 'a task on a feature it does not belong to', overrides: { task_id: 'task-green-mowed' } },
]

export const UNKNOWN_STATUS_CASES = [
  { label: 'a word that is not a status', overrides: { status: 'finished' } },
  { label: 'a status in capitals', overrides: { status: 'DONE' } },
  { label: 'no status', overrides: { status: undefined } },
  { label: 'a status that is a number', overrides: { status: 1 } },
]

// Entries mixed in with real marks that are not marks at all
export const NOT_A_MARK_CASES = [
  { label: 'null', entry: null },
  { label: 'text', entry: 'done' },
  { label: 'a number', entry: 42 },
]

// Things that are not a list of marks
export const NOT_A_MARK_LIST_CASES = [
  { label: 'null', serverMarks: null },
  { label: 'undefined', serverMarks: undefined },
  { label: 'an object', serverMarks: { marks: [] } },
  { label: 'text', serverMarks: 'done' },
]

// Times that cannot be read, so the mark has no time and the page shows only who made it
export const UNREADABLE_TIME_CASES = [
  { label: 'missing', overrides: { marked_at: undefined } },
  { label: 'text that is not a time', overrides: { marked_at: 'banana' } },
  { label: 'a number', overrides: { marked_at: 12345 } },
]

// Frozen, so any attempt to change them in place throws
export const FROZEN_SERVER_MARKS = Object.freeze([Object.freeze(makeServerMark('tee-box-mowed'))])