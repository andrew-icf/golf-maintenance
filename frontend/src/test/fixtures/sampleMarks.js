import { MARK_STATUS } from '../../features/hole/checklist/checklistMarks'
import { parseDateString } from '../../features/schedule/scheduleDates'

function timeOnDay(day, hours, minutes) {
  const date = parseDateString(day)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

// Marks like a hole might have by mid-morning, for the checklist tests: all by other people, keyed
// by the sample checklist's task ids. Their ids start with "sample-", so the page can never call
// one of them "You".
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
    ['tee-box-cleared', done('sample-yoda', 'Yoda', 5, 48)],
    ['par-3-tee-box-cleared', done('sample-yoda', 'Yoda', 5, 50)],
    ['pin-placement', done('sample-padme', 'Padmé Amidala', 5, 40)],
    ['fairway-mowed', done('sample-chewbacca', 'Chewbacca', 6, 40)],
    ['bunker-raked-machine:1', done('sample-chewbacca', 'Chewbacca', 6, 55)],
    ['fairway-sprayed', setAside('sample-din', 'Din Djarin')],
    ['green-rolled', setAside('sample-din', 'Din Djarin')],
    ['green-sprayed', setAside('sample-din', 'Din Djarin')],
  ])
}