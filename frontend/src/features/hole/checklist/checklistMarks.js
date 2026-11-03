import { formatShiftTime, parseDateString } from '../../schedule/scheduleDates'
import { canCheckTask } from './taskPermissions'

export const MARK_STATUS = { DONE: 'done', NOT_TODAY: 'not_today' }

const OPEN = 'open'

// The marks on a checklist are a Map from a task's id to what was done with it: checked off
// ("done") or set aside ("not_today"), with who did it and when. A task with no mark is open.
// Every function here returns a new Map, or the very same one when nothing changed, and never
// changes the one it was given.
export function statusOf(marks, itemId) {
  return marks?.get(itemId)?.status ?? OPEN
}

function setMark(marks, item, user, status, nowMs) {
  if (!item || !canCheckTask(user, item) || statusOf(marks, item.id) !== OPEN) {
    return marks
  }

  const updated = new Map(marks)
  updated.set(item.id, { status, byId: user.id, byName: user.full_name ?? '', at: nowMs })
  return updated
}

// Checks a task off, when the person may and the task is still open
export function checkItem(marks, item, user, nowMs) {
  return setMark(marks, item, user, MARK_STATUS.DONE, nowMs)
}

// Sets a task aside for today, when the person may and the task is still open
export function skipItem(marks, item, user, nowMs) {
  return setMark(marks, item, user, MARK_STATUS.NOT_TODAY, nowMs)
}

// Takes back a check or a "not today". Anyone who may check the task may undo it, whoever made
// the mark.
export function undoItem(marks, item, user) {
  if (!item || !canCheckTask(user, item) || statusOf(marks, item.id) === OPEN) {
    return marks
  }

  const updated = new Map(marks)
  updated.delete(item.id)
  return updated
}

// How far along a checklist is. A task set aside for today counts as accounted for, and the hole
// is complete when every task is accounted for. Marks on tasks that are not on the list are
// ignored.
export function summarizeProgress(items, marks) {
  const allItems = items ?? []
  let done = 0
  let notToday = 0

  for (const item of allItems) {
    const status = statusOf(marks, item.id)
    if (status === MARK_STATUS.DONE) {
      done += 1
    } else if (status === MARK_STATUS.NOT_TODAY) {
      notToday += 1
    }
  }

  const total = allItems.length
  const accountedFor = done + notToday

  return {
    total,
    done,
    notToday,
    accountedFor,
    open: total - accountedFor,
    isComplete: total > 0 && accountedFor === total,
  }
}

function padWithZero(number) {
  return String(number).padStart(2, '0')
}

// '5:48am', in the device's own time, or nothing when the time cannot be read
export function formatMarkTime(atMs) {
  const date = new Date(atMs)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return formatShiftTime(`${padWithZero(date.getHours())}:${padWithZero(date.getMinutes())}:00`)
}

// What the page says under a task: "Yoda · 5:48am", "You · 6:12am" when the person looking did
// it, "Not today", or nothing for an open task
export function describeMark(mark, user) {
  if (mark?.status === MARK_STATUS.DONE) {
    const who = Boolean(user?.id) && mark.byId === user.id ? 'You' : mark.byName || 'Someone'
    const time = formatMarkTime(mark.at)
    return time ? `${who} · ${time}` : who
  }

  return mark?.status === MARK_STATUS.NOT_TODAY ? 'Not today' : ''
}

function timeOnDay(day, hours, minutes) {
  const date = parseDateString(day)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

// The marks the preview starts with, all by other people, so the page shows who and when from
// the first moment. Their ids start with "sample-", so the page can never call one of them "You".
export function buildSampleMarks(day) {
  const done = (byId, byName, hours, minutes) => ({
    status: MARK_STATUS.DONE,
    byId,
    byName,
    at: timeOnDay(day, hours, minutes),
  })
  const setAside = (byId, byName) => ({
    status: MARK_STATUS.NOT_TODAY,
    byId,
    byName,
    at: timeOnDay(day, 5, 30),
  })

  return new Map([
    ['t-boxes-cleared', done('sample-yoda', 'Yoda', 5, 48)],
    ['par-3-t-boxes-cleared', done('sample-yoda', 'Yoda', 5, 50)],
    ['hole-placement-moved', done('sample-padme', 'Padmé Amidala', 5, 40)],
    ['fairway-mowed', done('sample-chewbacca', 'Chewbacca', 6, 40)],
    ['bunker-raked-machine:1', done('sample-chewbacca', 'Chewbacca', 6, 55)],
    ['fairway-sprayed', setAside('sample-din', 'Din Djarin')],
    ['green-rolled', setAside('sample-din', 'Din Djarin')],
    ['green-sprayed', setAside('sample-din', 'Din Djarin')],
  ])
}