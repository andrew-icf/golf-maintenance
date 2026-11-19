import { useMemo } from 'react'
import { Checklist } from './Checklist'
import { ResponsibleToday } from './ResponsibleToday'
import { formatClubDate, marksFromServer } from './checklistMarks'
import { buildChecklistItems, listDuties } from './checklistTasks'
import { buildSampleAssignments } from './responsibleList'
import { useHoleMarks } from './useHoleMarks'
import './HoleChecklist.css'

// Who is responsible and today's checklist for one hole. The tasks follow the club's task list and
// the hole's features, and the checks come from the server. The people under Responsible today are
// samples until assignments exist. The hole page keys this by hole.
export function HoleChecklist({ holeId, user, features, taskList }) {
  const items = useMemo(() => buildChecklistItems(features, taskList), [features, taskList])
  const { status, date, serverMarks, error, pendingIds, notice, check, skip, undo, retry, dismissNotice } =
    useHoleMarks(holeId)
  const marks = useMemo(() => marksFromServer(items, serverMarks), [items, serverMarks])
  const duties = listDuties(items, taskList?.duties)
  const clubDate = formatClubDate(date)

  return (
    <>
      <ResponsibleToday duties={ duties } assignments={ buildSampleAssignments(user) } user={ user } />
      { duties.length > 0 && (
        <p className="hole-checklist-note">
          The people under Responsible today are samples until assignments are set up.
        </p>
      )}

      { status === 'loading' && <p className="status">Loading today’s checks…</p> }

      { status === 'error' && (
        <div className="hole-checklist-error">
          <p role="alert" className="error">{ `Could not load today’s checks: ${error}` }</p>
          <button type="button" className="hole-checklist-retry" onClick={ retry }>
            Try again
          </button>
        </div>
      )}

      { status === 'ready' && (
        <>
          { clubDate && <p className="hole-checklist-date">{ `Checks for ${clubDate}` }</p> }
          <Checklist
            items={ items }
            marks={ marks }
            user={ user }
            pendingIds={ pendingIds }
            notice={ notice }
            onCheck={ check }
            onSkip={ skip }
            onUndo={ undo }
            onDismissNotice={ dismissNotice }
          />
        </>
      )}
    </>
  )
}