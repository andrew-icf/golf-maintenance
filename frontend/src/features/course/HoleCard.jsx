import { formatAmenityType } from '../../constants/amenities'
import './HoleCard.css'

// One hole as a card: its label ("C7"), par, yardage, and any amenity that sits on it.
// An amenity shows its type ("Comfort station"), or its own name when it has no type.
export function HoleCard({ label, hole, amenities }) {
  const amenitiesOnHole = amenities ?? []

  return (
    <li className="hole-card">
      <span className="hole-number">{ label }</span>
      <span className="hole-detail">Par { hole.par }</span>
      { typeof hole.yardage === 'number' && (
        <span className="hole-detail">{ hole.yardage } yds</span>
      )}
      { amenitiesOnHole.length > 0 && (
        <span className="hole-amenities">
          {amenitiesOnHole.map((amenity) => (
            <span key={ amenity.id } className="hole-amenity">
              { formatAmenityType(amenity.type) || amenity.name }
            </span>
          ))}
        </span>
      )}
    </li>
  )
}