import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { CreateShiftForm } from './CreateShiftForm'
import './AddShiftModal.css'

function describeShiftCount(count) {
  return count === 1 ? '1 shift' : `${count} shifts`
}

function describeResult({ createdCount, skippedCount }) {
  return {
    headline: createdCount === 0 ? 'No new shifts added' : `${describeShiftCount(createdCount)} added`,
    detail: skippedCount === 0 ? '' : `${describeShiftCount(skippedCount)} skipped (already scheduled)`,
  }
}

export function AddShiftModal({ onShiftsAdded, onClose }) {
  const [result, setResult] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const doneButtonRef = useRef(null)

  // The form unmounts on success, which drops focus. Put it on "Done" instead,
  // so keyboard users can press Enter to finish or Tab to "Add another".
  useEffect(() => {
    if (result) {
      doneButtonRef.current?.focus()
    }
  }, [result])

  function handleCreated(summary) {
    setResult(summary)
    onShiftsAdded()
  }

  function handleAddAnother() {
    setResult(null)
    // A new key makes React build a fresh form, so every field starts empty again
    setFormKey((current) => current + 1)
  }

  const description = result ? describeResult(result) : null

  return (
    <Modal title="Add shifts" onClose={ onClose }>
      { result ? (
        <div className="add-shift-result">
          <div role="status">
            <p className="result-headline">{ description.headline }</p>
            { description.detail && <p className="result-detail">{ description.detail }</p> }
          </div>
          <div className="result-actions">
            <button onClick={ handleAddAnother }>Add another</button>
            <button ref={ doneButtonRef } className="primary" onClick={ onClose }>Done</button>
          </div>
        </div>
      ) : (
        <CreateShiftForm key={ formKey } onCreated={ handleCreated } />
      )}
    </Modal>
  )
}