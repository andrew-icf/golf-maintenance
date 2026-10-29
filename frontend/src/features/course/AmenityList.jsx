import { Link } from 'react-router-dom'
import { holePath } from './holePath'
import './AmenityList.css'

// Every amenity of the club, in the order given. One that sits on a hole says which
// ("On C7") and opens that hole's page; a clubhouse or driving range belongs to the club as
// a whole and says nothing.
// `holeLabels` maps a hole's id to its label, from buildHoleLabels.
export function AmenityList({ amenities, holeLabels = new Map() }) {
  const allAmenities = amenities ?? []

  return (
    <section className="amenity-section">
      <h2 className="amenity-section-title">Amenities</h2>
      { allAmenities.length === 0 ? (
        <p className="status">No amenities yet.</p>
      ) : (
        <ul className="amenity-list">
          {allAmenities.map((amenity) => {
            const holeLabel = amenity.hole_id ? holeLabels.get(amenity.hole_id) : null

            return (
              <li key={ amenity.id } className="amenity-row">
                <span className="amenity-name">{ amenity.name }</span>
                { holeLabel && (
                  <Link to={ holePath(amenity.hole_id) } className="amenity-location">
                    On { holeLabel }
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}