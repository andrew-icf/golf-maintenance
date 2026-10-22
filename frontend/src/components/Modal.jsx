import { useEffect, useId, useRef } from 'react'
import './Modal.css'

export function Modal({ title, subtitle, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)

  // On open: lock page scrolling and move focus into the dialog.
  // On close: undo both, returning focus to whatever opened it.
  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleBackdropClick(event) {
    // Only a click on the dimmed area itself closes it, not a click inside the dialog
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={ handleBackdropClick }>
      <div
        ref={ dialogRef }
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ titleId }
        tabIndex={ -1 }
      >
        <button className="modal-close" aria-label="Close" onClick={ onClose }>
          ×
        </button>
        <div className="modal-header">
          <p id={ titleId } className="modal-title">{ title }</p>
          { subtitle && <p className="modal-subtitle">{ subtitle }</p> }
        </div>
        { children }
      </div>
    </div>
  )
}