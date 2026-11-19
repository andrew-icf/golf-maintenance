import { useId } from 'react'
import { MARK_STATUS, describeMark } from './checklistMarks'
import { canCheckTask, formatAllowedTitles } from './taskPermissions'

const SAVING_TEXT = 'Saving…'

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

// One task. The box checks it off, or takes the check back when it is done. A task set aside has a
// disabled box and an Undo button, and an open task has Not today. A task the person may not check
// is locked. While a change is saving the row says so and cannot be tapped, and notice is a message
// about the last change. label names the task with its area and section.
export function ChecklistRow({
  item,
  mark,
  user,
  label,
  isSaving = false,
  notice,
  onCheck,
  onSkip,
  onUndo,
  onDismissNotice,
}) {
  const metaId = useId()
  const mayCheck = canCheckTask(user, item)
  const isDone = mark?.status === MARK_STATUS.DONE
  const isSkipped = mark?.status === MARK_STATUS.NOT_TODAY
  const isOpen = !isDone && !isSkipped
  const isLocked = !mayCheck && isOpen
  const meta = isSaving ? SAVING_TEXT : describeMark(mark, user)
  const forTitles = formatAllowedTitles(item)
  const rowClass = ['checklist-row', isLocked && 'is-locked', isSkipped && 'is-skipped', isSaving && 'is-saving']
    .filter(Boolean)
    .join(' ')

  return (
    <li className={ rowClass } aria-busy={ isSaving ? 'true' : undefined }>
      <input
        type="checkbox"
        className="checklist-box"
        checked={ isDone }
        disabled={ !mayCheck || isSkipped || isSaving }
        onChange={ () => (isDone ? onUndo(item) : onCheck(item)) }
        aria-label={ label }
        aria-describedby={ meta ? metaId : undefined }
        data-state={ isSkipped ? MARK_STATUS.NOT_TODAY : undefined }
      />
      <div className="checklist-text">
        <p className="checklist-name">{ item.name }</p>
        { meta && <p id={ metaId } className="checklist-meta">{ meta }</p> }
        { notice && (
          <div className="checklist-notice">
            <p role="alert" className="checklist-notice-text">{ notice }</p>
            { onDismissNotice && (
              <button
                type="button"
                className="checklist-notice-dismiss"
                onClick={ onDismissNotice }
                aria-label={ `Dismiss message: ${label}` }
              >
                Dismiss
              </button>
            )}
          </div>
        )}
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
          disabled={ isSaving }
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
          disabled={ isSaving }
          onClick={ () => onUndo(item) }
          aria-label={ `Undo: ${label}` }
        >
          Undo
        </button>
      )}
    </li>
  )
}