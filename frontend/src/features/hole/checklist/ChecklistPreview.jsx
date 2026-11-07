import { useState } from 'react'
import { todayDateString } from '../../schedule/scheduleDates'
import { Checklist } from './Checklist'
import { buildSampleMarks, checkItem, skipItem, undoItem } from './checklistMarks'
import { buildChecklistItems } from './checklistTasks'

// The checklist with sample tasks, kept in this page's memory only: nothing is saved, and
// everything starts over when the page is shown again. user is the person looking.
export function ChecklistPreview({ user }) {
  const [items] = useState(() => buildChecklistItems())
  const [marks, setMarks] = useState(() => buildSampleMarks(todayDateString()))

  function handleCheck(item) {
    setMarks((current) => checkItem(current, item, user, Date.now()))
  }

  function handleSkip(item) {
    setMarks((current) => skipItem(current, item, user, Date.now()))
  }

  function handleUndo(item) {
    setMarks((current) => undoItem(current, item, user))
  }

  return (
    <>
      <p className="checklist-preview-banner">Preview with sample tasks. Checks are not saved.</p>
      <Checklist
        items={ items }
        marks={ marks }
        user={ user }
        onCheck={ handleCheck }
        onSkip={ handleSkip }
        onUndo={ handleUndo }
      />
    </>
  )
}