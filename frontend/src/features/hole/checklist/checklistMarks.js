import { formatDateString, formatShiftTime, parseDateString } from '../../schedule/scheduleDates'

export const MARK_STATUS = { DONE: 'done', NOT_TODAY: 'not_today' }

const OPEN = 'open'

// The marks on a checklist are a Map from a task's id to what was done with it: checked off
// ("done") or set aside ("not_today"), with who did it and when. A task with no mark is open.
export function statusOf(marks, itemId) {
  return marks?.get(itemId)?.status ?? OPEN
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

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 'Tuesday, November 17' for the club's date ('2026-11-17'), or nothing when it can't be read
export function formatClubDate(day) {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) {
    return ''
  }

  const date = parseDateString(day)
  // A date that doesn't exist, like 2026-02-30, rolls over into another day
  if (formatDateString(date) !== day) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

// Turns the server's marks for a hole into a Map from a task's id on this page to its mark.
// A mark is matched to a task by its feature and task ids, and one that matches nothing, or
// isn't a done or not_today mark, is left out.
export function marksFromServer(items, serverMarks) {
  const itemIdByPair = new Map()
  for (const item of items ?? []) {
    if (item.featureId && item.taskId) {
      itemIdByPair.set(`${item.featureId}|${item.taskId}`, item.id)
    }
  }

  const marks = new Map()
  if (!Array.isArray(serverMarks)) {
    return marks
  }

  for (const serverMark of serverMarks) {
    if (!serverMark || typeof serverMark !== 'object') {
      continue
    }
    if (serverMark.status !== MARK_STATUS.DONE && serverMark.status !== MARK_STATUS.NOT_TODAY) {
      continue
    }

    const itemId = itemIdByPair.get(`${serverMark.feature_id}|${serverMark.task_id}`)
    if (itemId === undefined || marks.has(itemId)) {
      continue
    }

    marks.set(itemId, {
      status: serverMark.status,
      byId: typeof serverMark.user_id === 'string' ? serverMark.user_id : '',
      byName: typeof serverMark.user_name === 'string' ? serverMark.user_name : '',
      at: typeof serverMark.marked_at === 'string' ? Date.parse(serverMark.marked_at) : NaN,
    })
  }

  return marks
}