const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_IN_WEEK = 7

function padWithZero(number) {
  return String(number).padStart(2, '0')
}

// Dates travel through the app as 'YYYY-MM-DD' strings, the same format the API uses.
// They only become Date objects inside this file, built from local calendar fields,
// because new Date('2026-10-05') means midnight UTC and displays as the previous day
// in timezones behind UTC.
export function parseDateString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDateString(date) {
  return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`
}

export function todayDateString() {
  return formatDateString(new Date())
}

export function addDays(dateString, dayCount) {
  const date = parseDateString(dateString)
  date.setDate(date.getDate() + dayCount)
  return formatDateString(date)
}

export function addWeeks(dateString, weekCount) {
  return addDays(dateString, weekCount * DAYS_IN_WEEK)
}

// Weeks start on Sunday
export function getWeekStart(dateString) {
  const date = parseDateString(dateString)
  return addDays(dateString, -date.getDay())
}

export function getWeekDates(weekStart) {
  return Array.from({ length: DAYS_IN_WEEK }, (unusedItem, dayOffset) => addDays(weekStart, dayOffset))
}

// '2026-10-05' -> { weekday: 'Mon', monthDay: '10/05' }
export function formatDayLabel(dateString) {
  const date = parseDateString(dateString)
  return {
    weekday: WEEKDAY_NAMES[date.getDay()],
    monthDay: `${padWithZero(date.getMonth() + 1)}/${padWithZero(date.getDate())}`,
  }
}

// '2026-10-04' -> 'Oct 4 – Oct 10, 2026'
export function formatWeekRange(weekStart) {
  const start = parseDateString(weekStart)
  const end = parseDateString(addDays(weekStart, DAYS_IN_WEEK - 1))
  const startText = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`
  const endText = `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`

  if (start.getFullYear() === end.getFullYear()) {
    return `${startText} – ${endText}, ${end.getFullYear()}`
  }
  return `${startText}, ${start.getFullYear()} – ${endText}, ${end.getFullYear()}`
}

// '04:00:00' -> '4am', '13:30:00' -> '1:30pm'
export function formatShiftTime(timeString) {
  const [hourText, minuteText] = timeString.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return minuteText === '00'
    ? `${displayHour}${suffix}`
    : `${displayHour}:${minuteText}${suffix}`
}

export function formatShiftRange(startTime, endTime) {
  return `${formatShiftTime(startTime)} – ${formatShiftTime(endTime)}`
}