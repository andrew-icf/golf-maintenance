import './HoleCard.css'

// One hole as a card: its label ("C7"), par, and yardage. Every card is the same size,
// whatever it shows, so a grid of holes reads as a tidy set of tiles.
export function HoleCard({ label, hole }) {
  return (
    <li className="hole-card">
      <span className="hole-number" title={ label }>{ label }</span>
      <span className="hole-detail">Par { hole.par }</span>
      { typeof hole.yardage === 'number' && (
        <span className="hole-detail">{ hole.yardage } yds</span>
      )}
    </li>
  )
}