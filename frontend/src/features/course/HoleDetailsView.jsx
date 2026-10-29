import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { formatAmenityType } from '../../constants/amenities'
import { formatYardage } from './courseSummary'
import { findHoleDetails } from './holeDetails'
import './HoleDetailsView.css'

function BackLink() {
  return (
    <Link to="/course" className="hole-details-back">
      ← Course
    </Link>
  )
}

export function HoleDetailsView() {
  const { holeId } = useParams()
  const [course, setCourse] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getCourse()
      .then(setCourse)
      .catch((requestError) => setError(requestError.message))
  }, [])

  if (error) {
    return (
      <div className="hole-details">
        <BackLink />
        <p className="error">{ error }</p>
      </div>
    )
  }

  if (!course) {
    return <p className="status">Loading hole...</p>
  }

  const details = findHoleDetails(course, holeId)

  if (!details) {
    return (
      <div className="hole-details">
        <BackLink />
        <p className="status">Hole not found.</p>
      </div>
    )
  }

  const subtitle = [details.courseName, details.groupTitle].filter(Boolean).join(' · ')

  return (
    <div className="hole-details">
      <BackLink />

      <header className="hole-details-header">
        <h2 className="hole-details-title">{ details.label }</h2>
        { subtitle && <p className="hole-details-subtitle">{ subtitle }</p> }
      </header>

      <dl className="hole-details-facts">
        <div>
          <dt>Par</dt>
          <dd>{ details.par }</dd>
        </div>
        <div>
          <dt>Yardage</dt>
          <dd>{ formatYardage(details.yardage) }</dd>
        </div>
      </dl>

      <section className="hole-details-section">
        <h3 className="hole-details-section-title">Amenities on this hole</h3>
        { details.amenities.length === 0 ? (
          <p className="status">No amenities on this hole.</p>
        ) : (
          <ul className="hole-details-amenities">
            {details.amenities.map((amenity) => {
              const typeLabel = formatAmenityType(amenity.type)

              return (
                <li key={ amenity.id } className="hole-details-amenity">
                  <span className="hole-details-amenity-name">{ amenity.name }</span>
                  { typeLabel && <span className="hole-details-amenity-type">{ typeLabel }</span> }
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}