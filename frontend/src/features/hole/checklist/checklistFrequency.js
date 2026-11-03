import { WEEKDAY_NAMES, formatDateString, parseDateString } from '../../schedule/scheduleDates'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// How often a task is due. A superintendent chooses one for each task:
//   every day:    { type: 'daily' }
//   every N days: { type: 'every_n_days', every: 2, anchor: '2026-11-02' }
//                 due on the anchor day and every N days before and after it, so "every other
//                 day" always lands on the same days
//   weekly:       { type: 'weekly', weekdays: [1, 4] }   (0 is Sunday, 6 is Saturday)
//   as needed:    { type: 'as_needed' }   (due only on days someone has scheduled it for)
export const FREQUENCY_TYPES = {
  DAILY: 'daily',
  EVERY_N_DAYS: 'every_n_days',
  WEEKLY: 'weekly',
  AS_NEEDED: 'as_needed',
}

export const DAILY = { type: FREQUENCY_TYPES.DAILY }

// Nothing, or something that is not a schedule, counts as every day
function asSchedule(frequency) {
  return frequency && typeof frequency === 'object' ? frequency : DAILY
}

// A real calendar day written 'YYYY-MM-DD'. '2026-13-45' is not one, though a Date would roll it
// over into some other day.
function isDay(value) {
  return typeof value === 'string' && DAY_PATTERN.test(value) && formatDateString(parseDateString(value)) === value
}

// Rounded, because a day with a clock change in it is 23 or 25 hours long
function daysBetween(fromDay, toDay) {
  return Math.round((parseDateString(toDay).getTime() - parseDateString(fromDay).getTime()) / MS_PER_DAY)
}

function isEveryNDays(schedule) {
  return (
    schedule.type === FREQUENCY_TYPES.EVERY_N_DAYS &&
    Number.isInteger(schedule.every) &&
    schedule.every >= 1 &&
    isDay(schedule.anchor)
  )
}

function isWeekly(schedule) {
  return (
    schedule.type === FREQUENCY_TYPES.WEEKLY &&
    Array.isArray(schedule.weekdays) &&
    schedule.weekdays.length > 0 &&
    schedule.weekdays.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday < DAYS_IN_WEEK)
  )
}

function joinWithAnd(labels) {
  if (labels.length <= 2) {
    return labels.join(' and ')
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

// Whether a task with this schedule is due on a day ('YYYY-MM-DD'). scheduledDays is the list of
// days an "as needed" task was scheduled for. When it cannot tell, because the day or the schedule
// cannot be read, the task counts as due: a task hidden by mistake is worse than one shown by
// mistake.
export function isDueOn(frequency, day, scheduledDays) {
  if (!isDay(day)) {
    return true
  }

  const schedule = asSchedule(frequency)

  if (schedule.type === FREQUENCY_TYPES.AS_NEEDED) {
    return Array.isArray(scheduledDays) && scheduledDays.includes(day)
  }
  if (isEveryNDays(schedule)) {
    return daysBetween(schedule.anchor, day) % schedule.every === 0
  }
  if (isWeekly(schedule)) {
    return schedule.weekdays.includes(parseDateString(day).getDay())
  }
  return true
}

// The schedule in words, for a note under a task: "Every other day", "Every 3 days",
// "Weekly on Mon and Thu", "As needed". Nothing for a task that is due every day, or whose
// schedule cannot be read.
export function describeFrequency(frequency) {
  const schedule = asSchedule(frequency)

  if (schedule.type === FREQUENCY_TYPES.AS_NEEDED) {
    return 'As needed'
  }
  if (isEveryNDays(schedule)) {
    if (schedule.every === 1) {
      return ''
    }
    return schedule.every === 2 ? 'Every other day' : `Every ${schedule.every} days`
  }
  if (isWeekly(schedule)) {
    const weekdays = [...new Set(schedule.weekdays)].sort((first, second) => first - second)
    if (weekdays.length === DAYS_IN_WEEK) {
      return ''
    }
    return `Weekly on ${joinWithAnd(weekdays.map((weekday) => WEEKDAY_NAMES[weekday]))}`
  }
  return ''
}