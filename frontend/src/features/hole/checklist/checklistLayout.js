import { formatJobTitle } from '../../../constants/jobTitles'
import { groupChecklist } from './checklistTasks'

const OTHER_COLUMN_KEY = 'other'

// The checklist is laid out in a column for each role, greenskeepers on the left and operators on
// the right. Any other role follows, in the order it first appears.
const LEADING_COLUMNS = ['greenskeeper', 'operator']

// A task sits in the column of the first job title it names. A task that names no usable job
// title goes in the "Other" column. Who may check it is decided elsewhere, by canCheckTask.
function columnKeyOf(item) {
  const titles = Array.isArray(item?.allowedJobTitles) ? item.allowedJobTitles : []
  const title = titles.find((candidate) => typeof candidate === 'string' && candidate !== '')

  return title ?? OTHER_COLUMN_KEY
}

function titleOfColumn(key) {
  if (key === OTHER_COLUMN_KEY) {
    return 'Other'
  }
  return formatJobTitle(key) || key
}

// The columns for the whole hole, so they line up in every section: the leading roles first,
// then the others as they appear, and "Other" last
function deriveColumnKeys(items) {
  const present = []
  for (const item of items) {
    const key = columnKeyOf(item)
    if (!present.includes(key)) {
      present.push(key)
    }
  }

  const leading = LEADING_COLUMNS.filter((key) => present.includes(key))
  const others = present.filter((key) => !LEADING_COLUMNS.includes(key) && key !== OTHER_COLUMN_KEY)
  const last = present.includes(OTHER_COLUMN_KEY) ? [OTHER_COLUMN_KEY] : []

  return [...leading, ...others, ...last]
}

// An admin owns every column, and anyone else owns only the column for their own job title. The
// role is compared exactly, the way the server compares it.
function isYoursColumn(key, user) {
  if (!user) {
    return false
  }
  if (user.role === 'admin') {
    return true
  }
  return key !== OTHER_COLUMN_KEY && typeof user.job_title === 'string' && user.job_title === key
}

// The checklist as the page draws it: the columns, then each area's sections with one cell for
// every column, so the columns line up even where one has nothing to show.
export function buildChecklistLayout(items, user) {
  const allItems = items ?? []

  const columns = deriveColumnKeys(allItems).map((key) => ({
    key,
    title: titleOfColumn(key),
    isYours: isYoursColumn(key, user),
  }))

  const areas = groupChecklist(allItems).map((group) => ({
    key: group.key,
    title: group.title,
    sections: group.sections.map((section) => ({
      key: section.key,
      title: section.title,
      cells: columns.map((column) => ({
        columnKey: column.key,
        items: section.items.filter((item) => columnKeyOf(item) === column.key),
      })),
    })),
  }))

  return { columns, areas }
}