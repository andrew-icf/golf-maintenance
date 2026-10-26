import { useEffect, useState } from 'react'
import { api } from '../../api'
import { EQUIPMENT_STATUS_OPTIONS, formatEquipmentType } from '../../constants/equipment'
import './EquipmentView.css'

function EquipmentRow({ item, onStatusChange }) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const typeLabel = formatEquipmentType(item.type)

  async function handleChange(event) {
    const newStatus = event.target.value
    setUpdatingStatus(true)
    try {
      await api.updateEquipmentStatus(item.id, newStatus)
      onStatusChange(item.id, newStatus)
    } catch (requestError) {
      alert(requestError.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <li className={ `equipment-row status-${item.status}` }>
      <span className="equipment-label">{ typeLabel }</span>
      <select
        aria-label={ `Status of ${item.label} (${typeLabel})` }
        value={ item.status }
        onChange={ handleChange }
        disabled={ updatingStatus }
      >
        {EQUIPMENT_STATUS_OPTIONS.map(({ value, label }) => (
          <option key={ value } value={ value }>{ label }</option>
        ))}
      </select>
    </li>
  )
}

export function EquipmentView() {
  const [equipment, setEquipment] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getEquipment()
      .then(setEquipment)
      .catch((requestError) => setError(requestError.message))
  }, [])

  function handleStatusChange(id, newStatus) {
    setEquipment((current) =>
      current.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    )
  }

  if (error) {
    return <p className="error">{ error }</p>
  }

  if (!equipment) {
    return <p className="status">Loading equipment...</p>
  }

  if (equipment.length === 0) {
    return <p className="status">No equipment yet.</p>
  }

  const carts = equipment.filter((item) => !item.parent_equipment_id)

  return (
    <div className="equipment-view">
      {carts.map((cart) => {
        const attached = equipment.filter((item) => item.parent_equipment_id === cart.id)
        return (
          <section key={ cart.id } className="equipment-section">
            <h2 className="equipment-section-title">{ cart.label }</h2>
            <ul className="equipment-list">
              <EquipmentRow item={ cart } onStatusChange={ handleStatusChange } />
              {attached.map((item) => (
                <EquipmentRow key={ item.id } item={ item } onStatusChange={ handleStatusChange } />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}