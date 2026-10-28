import { useEffect, useState } from 'react'
import { api } from '../../api'
import { AmenityList } from './AmenityList'
import { LayoutSection } from './LayoutSection'
import { buildHoleLabels, groupAmenitiesByHole } from './courseLayout'
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

  const layouts = course.layouts ?? []
  const amenities = course.amenities ?? []
  const amenitiesByHole = groupAmenitiesByHole(amenities)
  const holeLabels = buildHoleLabels(layouts)

  return (
    <div className="course-view">
      { layouts.length === 0 ? (
        <p className="status">No courses set up yet.</p>
      ) : (
        layouts.map((layout) => (
          <LayoutSection
            key={ layout.id }
            layout={ layout }
            layoutCount={ layouts.length }
            amenitiesByHole={ amenitiesByHole }
          />
        ))
      )}
      <AmenityList amenities={ amenities } holeLabels={ holeLabels } />
    </div>
  )
}