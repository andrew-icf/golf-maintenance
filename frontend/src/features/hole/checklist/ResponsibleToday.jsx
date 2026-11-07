import { useId } from 'react'
import { buildResponsibleList } from './responsibleList'
import './ResponsibleToday.css'

// The people answerable for each part of the hole today. Who may check a task is decided
// elsewhere, so this only says who to ask. It shows nothing when there are no duties.
export function ResponsibleToday({ duties, assignments, user }) {
  const titleId = useId()
  const entries = buildResponsibleList(duties, assignments, user)

  if (entries.length === 0) {
    return null
  }

  return (
    <section className="responsible" aria-labelledby={ titleId }>
      <div>
        <h3 id={ titleId } className="responsible-title">Responsible today</h3>
        <p className="responsible-note">
          Each person checks off only their own work. These are the people answerable for this hole.
        </p>
      </div>

      <ul className="responsible-list">
        {entries.map((entry) => (
          <li key={ entry.key } className="responsible-tile">
            <span className="responsible-duty">{ entry.title }</span>
            { entry.people.length === 0 ? (
              <span className="responsible-person responsible-none">Not assigned</span>
            ) : (
              <ul className="responsible-people">
                {entry.people.map((person) => (
                  <li key={ person.key } className="responsible-person">
                    { person.isYou ? `${person.name} (you)` : person.name }
                    { person.titleLabel && (
                      <span className={ `person-chip chip-${person.tone}` }>{ person.titleLabel }</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}