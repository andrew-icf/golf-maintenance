import { useEffect, useState } from 'react'
import { api } from '../api'
import './CourseView.css'

export function CourseView() {
  const [course, setCourse] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getCourse()
      .then(setCourse)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return <p className="error">{ error }</p>
  }

  if (!course) {
    return <p className="status">Loading course...</p>
  }

  return (
    <div className="course-view">
      <h2>{ course.name }</h2>

      <section>
        <h3>Holes</h3>
        <div className="hole-grid">
          { course.holes.map((hole) => (
            <div key={ hole.id } className="hole-card">
              <span className="hole-number">Hole { hole.hole_number }</span>
              <span className="hole-detail">Par { hole.par }</span>
              { hole.yardage && <span className="hole-detail">{ hole.yardage } yds</span> }
            </div>
          )) }
        </div>
      </section>

      <section>
        <h3>Amenities</h3>
        <ul className="amenity-list">
          { course.amenities.map((amenity) => (
            <li key={ amenity.id }>{ amenity.name }</li>
          )) }
        </ul>
      </section>
    </div>
  )
}