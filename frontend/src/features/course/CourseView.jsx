import { useEffect, useState } from 'react'
import { api } from '../../api'
import './CourseView.css'

export function CourseView() {
  const [course, setCourse] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getCourse()
      .then(setCourse)
      .catch((requestError) => setError(requestError.message))
  }, [])

  if (error) {
    return <p className="error">{ error }</p>
  }

  if (!course) {
    return <p className="status">Loading course...</p>
  }

  const holes = course.holes ?? []
  const amenities = course.amenities ?? []

  return (
    <div className="course-view">
      <section className="course-section">
        <h2 className="course-section-title">Holes</h2>
        { holes.length === 0 ? (
          <p className="status">No holes yet.</p>
        ) : (
          <ul className="hole-grid">
            {holes.map((hole) => (
              <li key={ hole.id } className="hole-card">
                <span className="hole-number">Hole { hole.hole_number }</span>
                <span className="hole-detail">Par { hole.par }</span>
                { typeof hole.yardage === 'number' && (
                  <span className="hole-detail">{ hole.yardage } yds</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="course-section">
        <h2 className="course-section-title">Amenities</h2>
        { amenities.length === 0 ? (
          <p className="status">No amenities yet.</p>
        ) : (
          <ul className="amenity-list">
            {amenities.map((amenity) => (
              <li key={ amenity.id }>{ amenity.name }</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}