import {
  formatGroupTitle,
  formatHoleLabel,
  formatHoleRange,
  splitFrontBack,
} from './courseLayout'
import { HoleCard } from './HoleCard'
import './LayoutSection.css'

// One course of the club ("Course C") with its holes split into front and back, side by
// side when there is room, so a nine sits on one row. A club with a single course calls it
// "Holes", since the club has no other course to tell it apart from.
export function LayoutSection({ layout, layoutCount }) {
  const holes = layout.holes ?? []
  const title = layoutCount > 1 ? layout.name : 'Holes'

  return (
    <section className="layout-section">
      <h2 className="layout-title">{ title }</h2>

      { holes.length === 0 ? (
        <p className="status">No holes yet.</p>
      ) : (
        <div className="hole-groups">
          {splitFrontBack(layout).map((group) => {
            const groupTitle = formatGroupTitle(layout, group.key, layoutCount)

            return (
              <div
                key={ group.key }
                className="hole-group"
                style={ { '--hole-count': group.holes.length } }
              >
                { groupTitle && (
                  <div className="group-header">
                    <h3 className="group-title">{ groupTitle }</h3>
                    <span className="group-range">{ formatHoleRange(layout, group.holes, layoutCount) }</span>
                  </div>
                )}
                <ul className="hole-grid">
                  {group.holes.map((hole) => (
                    <HoleCard
                      key={ hole.id }
                      label={ formatHoleLabel(layout, hole, layoutCount) }
                      hole={ hole }
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}