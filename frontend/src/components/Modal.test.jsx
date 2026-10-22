import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

// Test data
const TITLE = 'Luke Skywalker'
const SUBTITLE = 'Sun 10/04'
const BODY_TEXT = 'Edit this shift'
const OPEN_BUTTON_LABEL = 'Open modal'
const KEYS_THAT_DO_NOT_CLOSE = ['{Enter}', 'a', '{Tab}', '{ArrowDown}']
const SCROLL_STYLE_BEFORE_OPENING = 'scroll'

// Actions
function renderModal({ subtitle } = {}) {
  const onClose = vi.fn()
  const view = render(
    <Modal title={ TITLE } subtitle={ subtitle } onClose={ onClose }>
      <p>{ BODY_TEXT }</p>
    </Modal>
  )
  return { onClose, ...view }
}

// A page with a button that opens the modal, the way the app will use it
function ModalWithOpener() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={ () => setIsOpen(true) }>{ OPEN_BUTTON_LABEL }</button>
      { isOpen && (
        <Modal title={ TITLE } onClose={ () => setIsOpen(false) }>
          <p>{ BODY_TEXT }</p>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  describe('content', () => {
    it('shows the body and names the dialog after its title', () => {
      renderModal()

      expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument()
      expect(screen.getByText(BODY_TEXT)).toBeInTheDocument()
    })

    it('shows the subtitle when one is given', () => {
      renderModal({ subtitle: SUBTITLE })

      expect(screen.getByText(SUBTITLE)).toBeInTheDocument()
    })

    it('shows no subtitle line when none is given', () => {
      const { container } = renderModal()

      expect(container.querySelector('.modal-subtitle')).toBeNull()
    })
  })

  describe('closing', () => {
    it('closes from the × button', async () => {
      const { onClose } = renderModal()

      await userEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes when Escape is pressed', async () => {
      const { onClose } = renderModal()

      await userEvent.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it.each(KEYS_THAT_DO_NOT_CLOSE)('ignores the %s key', async (key) => {
      const { onClose } = renderModal()

      await userEvent.keyboard(key)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('closes when the dimmed backdrop is clicked', async () => {
      const { onClose } = renderModal()
      // The backdrop is the dialog's parent element, and has no role to query by
      const backdrop = screen.getByRole('dialog').parentElement

      await userEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('stays open when the dialog itself or its content is clicked', async () => {
      const { onClose } = renderModal()

      await userEvent.click(screen.getByText(BODY_TEXT))
      await userEvent.click(screen.getByRole('dialog'))

      expect(onClose).not.toHaveBeenCalled()
    })

    it('stops listening for Escape once it has been removed', async () => {
      const { onClose, unmount } = renderModal()

      unmount()
      await userEvent.keyboard('{Escape}')

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('focus and scrolling', () => {
    it('moves focus into the dialog when it opens', () => {
      renderModal()

      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    it('returns focus to the button that opened it when it closes', async () => {
      render(<ModalWithOpener />)
      const openButton = screen.getByRole('button', { name: OPEN_BUTTON_LABEL })

      await userEvent.click(openButton)
      expect(screen.getByRole('dialog')).toHaveFocus()

      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(openButton).toHaveFocus()
    })

    it('locks page scrolling while open and restores it afterwards', () => {
      document.body.style.overflow = SCROLL_STYLE_BEFORE_OPENING
      const { unmount } = renderModal()

      expect(document.body.style.overflow).toBe('hidden')

      unmount()

      expect(document.body.style.overflow).toBe(SCROLL_STYLE_BEFORE_OPENING)
    })
  })
})