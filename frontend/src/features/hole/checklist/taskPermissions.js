import { formatJobTitle } from '../../../constants/jobTitles'

// A task names the job titles allowed to check it off, in allowedJobTitles. A person may check
// it when their job title is one of those, or when they are an admin. Everyone else can see the
// task but not check it. This only decides what the screen offers: the server decides again
// and has the last word. The role is compared exactly, the way the server compares it.
export function canCheckTask(user, task) {
  if (!user || !task) {
    return false
  }
  if (user.role === 'admin') {
    return true
  }

  const allowedTitles = Array.isArray(task.allowedJobTitles) ? task.allowedJobTitles : []
  return typeof user.job_title === 'string' && allowedTitles.includes(user.job_title)
}

// Who a task is for, in words: "Greenskeeper", "Greenskeeper or Operator", or
// "Greenskeeper, Operator, or Landscaper". Titles it does not recognize are left out, and a
// title listed twice counts once. Nothing when no one is named, since only admins may check it.
export function formatAllowedTitles(task) {
  const titles = Array.isArray(task?.allowedJobTitles) ? task.allowedJobTitles : []
  const labels = [...new Set(titles.map((title) => formatJobTitle(title)).filter(Boolean))]

  if (labels.length <= 2) {
    return labels.join(' or ')
  }
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}