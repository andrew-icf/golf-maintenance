// The top of the checklist: how many tasks are accounted for, a bar, and a line saying how they
// split. A task set aside for today counts as accounted for.
export function ChecklistProgress({ summary, titleId }) {
  const { total, done, notToday, accountedFor, isComplete } = summary
  const percent = total > 0 ? Math.round((accountedFor / total) * 100) : 0

  return (
    <div className="checklist-top">
      <div className="checklist-top-line">
        <h2 id={ titleId } className="checklist-title">Today’s checklist</h2>
        { total > 0 && (
          <p className="checklist-count">
            { `${accountedFor} of ${total} ${total === 1 ? 'task' : 'tasks'} accounted for` }
          </p>
        )}
      </div>

      { total === 0 ? (
        <p className="checklist-note">There are no tasks for this hole today.</p>
      ) : (
        <>
          <div
            role="progressbar"
            aria-label="Tasks accounted for"
            aria-valuemin={ 0 }
            aria-valuemax={ total }
            aria-valuenow={ accountedFor }
            className="checklist-bar"
          >
            <div className="checklist-bar-fill" style={ { width: `${percent}%` } } />
          </div>
          <p className="checklist-note">
            { isComplete
              ? 'Every task is accounted for.'
              : `${done} done · ${notToday} not today. The hole is completed when every task is checked or marked not today.` }
          </p>
        </>
      )}
    </div>
  )
}