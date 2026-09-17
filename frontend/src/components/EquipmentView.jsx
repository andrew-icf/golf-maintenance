import { useEffect, useState } from 'react'
import { api } from '../api'
import './EquipmentView.css'

const STATUS_LABELS = {
  working_order: 'Working Order',
  needs_repair: 'Needs Repair',
  in_shop: 'In Shop',
}

const TYPE_LABELS = {
  cart: 'Cart',
  trash_can: 'Trash Can',
  ball_mark_repair_tool: 'Ball Mark Repair Tool',
  sand_tube: 'Ball Marker Eraser (Sand Tube)',
  weed_eater: 'Weed Eater',
  edger: 'Edger',
  blower: 'Blower',
  hole_punch: 'Hole Punch',
  bucket: 'Bucket',
  cup_puller: 'Cup Puller',
  cup_setter: 'Cup Setter',
  dust_pan: 'Dust Pan',
  sand_bucket: 'Sand Bucket w/ Scooper',
  chainsaw: 'Chainsaw',
  gas_can: 'Gas Can',
}

function EquipmentRow({ item, onStatusChange }) {
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function handleChange(e) {
    const newStatus = e.target.value
    setUpdatingStatus(true)
    try {
      await api.updateEquipmentStatus(item.id, newStatus)
      onStatusChange(item.id, newStatus)
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <li className={`equipment-row status-${item.status}`}>
      <span className="equipment-label">{ TYPE_LABELS[item.type] || item.type }</span>
      <select value={ item.status } onChange={ handleChange } disabled={ updatingStatus }>
        {Object.entries(STATUS_LABELS).map(([value, text]) => (
          <option key={ value } value={ value }>{ text }</option>
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
      .catch((err) => setError(err.message))
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

  const carts = equipment.filter((item) => !item.parent_equipment_id)

  return (
    <div className="equipment-view">
      <h2>Equipment</h2>
      {carts.map((cart) => {
        const attached = equipment.filter((item) => item.parent_equipment_id === cart.id)
        return (
          <section key={ cart.id }>
            <h3>{ cart.label }</h3>
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