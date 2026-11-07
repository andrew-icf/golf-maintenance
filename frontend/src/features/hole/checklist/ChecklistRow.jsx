import { useId } from 'react'
import { MARK_STATUS, describeMark } from './checklistMarks'
import { canCheckTask, formatAllowedTitles } from './taskPermissions'

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

// One task. The box checks it off, or takes the check back when it is already done. A task set
// aside for today has a disabled box and an Undo button, and an open task has Not today. A task
// the person may not check is locked, with a lock that says who it is for. label names the task
// with its area and section, because the same name turns up in several places.
export function ChecklistRow({ item, mark, user, label, onCheck, onSkip, onUndo }) {
  const metaId = useId()
  const mayCheck = canCheckTask(user, item)
  const isDone = mark?.status === MARK_STATUS.DONE
  const isSkipped = mark?.status === MARK_STATUS.NOT_TODAY
  const isOpen = !isDone && !isSkipped
  const isLocked = !mayCheck && isOpen
  const meta = describeMark(mark, user)
  const forTitles = formatAllowedTitles(item)
  const rowClass = ['checklist-row', isLocked && 'is-locked', isSkipped && 'is-skipped']
    .filter(Boolean)
    .join(' ')

  return (
    <li className={ rowClass }>
      <input
        type="checkbox"
        className="checklist-box"
        checked={ isDone }
        disabled={ !mayCheck || isSkipped }
        onChange={ () => (isDone ? onUndo(item) : onCheck(item)) }
        aria-label={ label }
        aria-describedby={ meta ? metaId : undefined }
        data-state={ isSkipped ? MARK_STATUS.NOT_TODAY : undefined }
      />
      <div className="checklist-text">
        <p className="checklist-name">{ item.name }</p>
        { meta && <p id={ metaId } className="checklist-meta">{ meta }</p> }
      </div>

      { isLocked && (
        <span
          className="checklist-lock"
          role="img"
          aria-label={ forTitles ? `Locked: for ${forTitles}` : 'Locked: admins only' }
        >
          <LockIcon />
        </span>
      )}
      { mayCheck && isOpen && (
        <button
          type="button"
          className="checklist-action"
          onClick={ () => onSkip(item) }
          aria-label={ `Not today: ${label}` }
        >
          Not today
        </button>
      )}
      { mayCheck && isSkipped && (
        <button
          type="button"
          className="checklist-action"
          onClick={ () => onUndo(item) }
          aria-label={ `Undo: ${label}` }
        >
          Undo
        </button>
      )}
    </li>
  )
}