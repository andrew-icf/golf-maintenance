import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Makes everything on the page except the modal itself unreachable by mouse, keyboard,
// and screen readers. Elements that were already inert (because another modal is open)
// are left alone, so stacked modals don't undo each other.
function makeRestOfPageInert(modalRoot) {
  const changedElements = []

  for (const element of document.body.children) {
    if (element === modalRoot || element.hasAttribute('inert')) {
      continue
    }
    element.setAttribute('inert', '')
    changedElements.push(element)
  }

  return () => {
    for (const element of changedElements) {
      element.removeAttribute('inert')
    }
  }
}

export function Modal({ title, subtitle, onClose, dismissible = true, children }) {
  const titleId = useId()
  const backdropRef = useRef(null)
  const dialogRef = useRef(null)

  // On open: lock page scrolling, make the rest of the page inert, and move focus into
  // the dialog. On close, in this order: make the page reachable again, then return focus
  // to whatever opened the dialog (an inert element can't take focus).
  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreRestOfPage = makeRestOfPageInert(backdropRef.current)
    dialogRef.current.focus()

    return () => {
      restoreRestOfPage()
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (dismissible) {
          onClose()
        }
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      // Keep Tab and Shift+Tab cycling inside the dialog
      const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dismissible, onClose])

  function handleBackdropClick(event) {
    // Only a click on the dimmed area itself closes it, not a click inside the dialog
    if (dismissible && event.target === event.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div ref={ backdropRef } className="modal-backdrop" onClick={ handleBackdropClick }>
      <div
        ref={ dialogRef }
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ titleId }
        tabIndex={ -1 }
      >
        { dismissible && (
          <button className="modal-close" aria-label="Close" onClick={ onClose }>
            ×
          </button>
        )}
        <div className="modal-header">
          <p id={ titleId } className="modal-title">{ title }</p>
          { subtitle && <p className="modal-subtitle">{ subtitle }</p> }
        </div>
        { children }
      </div>
    </div>,
    document.body
  )
}