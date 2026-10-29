import {
  formatGroupTitle,
  formatHoleLabel,
  formatHoleRange,
  formatLayoutTotals,
  splitFrontBack,
  summarizeLayout,
} from './courseLayout'
import { HoleCard } from './HoleCard'
import './LayoutSection.css'

// One course of the club ("Course C") with its par and yardage, and its holes split into
// front and back. A club with a single course calls it "Holes", since the club has no other
// course to tell it apart from.
export function LayoutSection({ layout, layoutCount }) {
  const holes = layout.holes ?? []
  const title = layoutCount > 1 ? layout.name : 'Holes'
  const totals = formatLayoutTotals(summarizeLayout(layout))

  return (
    <section className="layout-section">
      <div className="layout-header">
        <h2 className="layout-title">{ title }</h2>
        { totals && <p className="layout-totals">{ totals }</p> }
      </div>

      { holes.length === 0 ? (
        <p className="status">No holes yet.</p>
      ) : (
        splitFrontBack(layout).map((group) => {
          const groupTitle = formatGroupTitle(layout, group.key, layoutCount)

          return (
            <div key={ group.key } className="hole-group">
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
        })
      )}
    </section>
  )
}