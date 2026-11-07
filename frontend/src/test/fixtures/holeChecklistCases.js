import { LUKE, MON_MOTHMA, YODA } from './taskPermissionCases'

// Test data for the checklist on the hole page
export const RESPONSIBLE_NAME = 'Responsible today'
export const CHECKLIST_NAME = 'Today’s checklist'

// Which of the two columns, Greenskeeper then Operator, belong to each person looking at the page
export const VIEWER_PAGE_CASES = [
  { name: 'Luke, an operator', user: LUKE, expectedYours: [false, true] },
  { name: 'Yoda, a greenskeeper', user: YODA, expectedYours: [true, false] },
  { name: 'Mon Mothma, a superintendent', user: MON_MOTHMA, expectedYours: [true, true] },
]