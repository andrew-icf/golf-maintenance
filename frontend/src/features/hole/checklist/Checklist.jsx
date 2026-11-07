import { useId } from 'react'
import { ChecklistProgress } from './ChecklistProgress'
import { ChecklistRow } from './ChecklistRow'
import { buildChecklistLayout } from './checklistLayout'
import { summarizeProgress } from './checklistMarks'
import './Checklist.css'

const KNOWN_TONES = ['greenskeeper', 'operator']

// Greenskeepers are green and operators amber, and any other role gets a neutral color
function toneOf(columnKey) {
  return KNOWN_TONES.includes(columnKey) ? columnKey : 'other'
}

// "Tee box" for a task straight under an area, "Bunkers, Bunker 2" for a task in a section
function contextOf(area, section) {
  return section.title && section.title !== area.title ? `${area.title}, ${section.title}` : area.title
}

// Today's checklist for one hole: a column for each role, an area label down the left, and the
// sections of tasks inside. It only shows what it is given and reports clicks through onCheck,
// onSkip, and onUndo, each handed the task. marks is a Map of what has been done so far.
export function Checklist({ items, marks, user, onCheck, onSkip, onUndo }) {
  const titleId = useId()
  const { columns, areas } = buildChecklistLayout(items, user)
  const summary = summarizeProgress(items, marks)
  const toneByColumn = new Map(columns.map((column) => [column.key, toneOf(column.key)]))

  return (
    <section
      className="checklist"
      aria-labelledby={ titleId }
      style={ { '--column-count': columns.length } }
    >
      <ChecklistProgress summary={ summary } titleId={ titleId } />

      { columns.length > 0 && (
        <div className="checklist-heads">
          <div className="checklist-gutter" />
          {columns.map((column) => (
            <div key={ column.key } className={ `checklist-head tone-${toneByColumn.get(column.key)}` }>
              <span className="checklist-swatch" aria-hidden="true" />
              { column.title }
              { column.isYours && <span className="checklist-mine">Your tasks</span> }
            </div>
          ))}
        </div>
      )}

      {areas.map((area) => (
        <div key={ area.key } className="checklist-area">
          <h3 className="checklist-area-label"><span>{ area.title }</span></h3>
          <div className="checklist-area-body">
            {area.sections.map((section) => (
              <div key={ section.key } className="checklist-section">
                { section.title && <h4 className="checklist-section-title">{ section.title }</h4> }
                <div className="checklist-cells">
                  {section.cells.map((cell) => {
                    const column = columns.find((candidate) => candidate.key === cell.columnKey)

                    return (
                      <div key={ cell.columnKey } className={ `checklist-cell tone-${toneByColumn.get(cell.columnKey)}` }>
                        { cell.items.length > 0 && (
                          <>
                            <p className="checklist-cell-role">{ column.title }</p>
                            <ul className="checklist-list">
                              {cell.items.map((item) => (
                                <ChecklistRow
                                  key={ item.id }
                                  item={ item }
                                  mark={ marks?.get(item.id) }
                                  user={ user }
                                  label={ `${contextOf(area, section)}: ${item.name}` }
                                  onCheck={ onCheck }
                                  onSkip={ onSkip }
                                  onUndo={ onUndo }
                                />
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}