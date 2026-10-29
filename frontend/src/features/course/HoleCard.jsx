import { Link } from 'react-router-dom'
import { holePath } from '../hole/holePath'
import './HoleCard.css'

// One hole as a card that opens the hole's details: its label ("C7"), par, and yardage.
export function HoleCard({ label, hole }) {
  return (
    <li>
      <Link to={ holePath(hole.id) } className="hole-card">
        <span className="hole-number" title={ label }>{ label }</span>
        <span className="hole-detail">Par { hole.par }</span>
        { typeof hole.yardage === 'number' && (
          <span className="hole-detail">{ hole.yardage } yds</span>
        )}
      </Link>
    </li>
  )
}