import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

// Test data
const TITLE = 'Luke Skywalker'
const OTHER_TITLE = 'Leia Organa'
const SUBTITLE = 'Sun 10/04'
const BODY_TEXT = 'Edit this shift'
const FIRST_ACTION = 'First action'
const SECOND_ACTION = 'Second action'
const ONLY_ACTION = 'Only action'
const CLOSE_BUTTON = 'Close'
const OPEN_BUTTON_LABEL = 'Open modal'
const EXIT_BUTTON_LABEL = 'Clock in'
const AFTER_EXIT_TEXT = 'Back on the page'
const KEYS_THAT_DO_NOT_CLOSE = ['{Enter}', 'a', '{Tab}', '{ArrowDown}']
const SCROLL_STYLE_BEFORE_OPENING = 'scroll'

// Pressing Tab on a control the Modal should leave alone, so the browser moves focus itself
const TAB_LEFT_TO_THE_BROWSER_CASES = [
  { label: 'Tab on the first control', control: CLOSE_BUTTON, shift: false },
  { label: 'Tab on a middle control', control: FIRST_ACTION, shift: false },
  { label: 'Shift+Tab on a middle control', control: FIRST_ACTION, shift: true },
  { label: 'Shift+Tab on the last control', control: SECOND_ACTION, shift: true },
]

// Elements added to the page outside the app, removed after each test
const pageElementsToRemove = []

function addElementToPage({ inert = false } = {}) {
  const element = document.createElement('div')
  if (inert) {
    element.setAttribute('inert', '')
  }
  document.body.appendChild(element)
  pageElementsToRemove.push(element)
  return element
}

// Actions
function renderModal({ subtitle, dismissible } = {}) {
  const onClose = vi.fn()
  const view = render(
    <Modal title={ TITLE } subtitle={ subtitle } dismissible={ dismissible } onClose={ onClose }>
      <p>{ BODY_TEXT }</p>
    </Modal>
  )
  return { onClose, ...view }
}

function renderModalWithActions({ dismissible } = {}) {
  const onClose = vi.fn()
  const view = render(
    <Modal title={ TITLE } dismissible={ dismissible } onClose={ onClose }>
      <button>{ FIRST_ACTION }</button>
      <button>{ SECOND_ACTION }</button>
    </Modal>
  )
  return { onClose, ...view }
}

function button(name) {
  return screen.getByRole('button', { name })
}

// Presses Tab on whatever has focus. Returns true when the Modal left the key alone, so the
// browser would move focus itself, and false when the Modal took over and moved focus.
function pressTab({ shift = false } = {}) {
  return fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: shift })
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

// A locked modal that its own content can close, the way Clock in will close the gate
function LockedModalWithExit() {
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) {
    return <p>{ AFTER_EXIT_TEXT }</p>
  }

  return (
    <Modal title={ TITLE } dismissible={ false }>
      <button onClick={ () => setIsOpen(false) }>{ EXIT_BUTTON_LABEL }</button>
    </Modal>
  )
}

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = ''
    pageElementsToRemove.splice(0).forEach((element) => element.remove())
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
      renderModal()

      expect(document.querySelector('.modal-subtitle')).toBeNull()
    })
  })

  describe('closing', () => {
    it('closes from the × button', async () => {
      const { onClose } = renderModal()

      await userEvent.click(button(CLOSE_BUTTON))

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

  describe('when it cannot be dismissed', () => {
    it('has no × button', () => {
      renderModal({ dismissible: false })

      expect(screen.queryByRole('button', { name: CLOSE_BUTTON })).not.toBeInTheDocument()
    })

    it('ignores the Escape key', async () => {
      const { onClose } = renderModal({ dismissible: false })

      await userEvent.keyboard('{Escape}')

      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('ignores a click on the dimmed backdrop', async () => {
      const { onClose } = renderModal({ dismissible: false })

      await userEvent.click(screen.getByRole('dialog').parentElement)

      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('still names itself after its title and takes focus', () => {
      renderModal({ dismissible: false })

      expect(screen.getByRole('dialog', { name: TITLE })).toHaveFocus()
    })

    it('works without an onClose handler', async () => {
      render(
        <Modal title={ TITLE } dismissible={ false }>
          <p>{ BODY_TEXT }</p>
        </Modal>
      )

      await userEvent.keyboard('{Escape}')
      await userEvent.click(screen.getByRole('dialog').parentElement)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('goes away when its content stops rendering it, and the page is reachable again', async () => {
      const { container } = render(<LockedModalWithExit />)
      expect(container).toHaveAttribute('inert')

      await userEvent.click(button(EXIT_BUTTON_LABEL))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText(AFTER_EXIT_TEXT)).toBeInTheDocument()
      expect(container).not.toHaveAttribute('inert')
    })
  })

  describe('where it renders', () => {
    it('renders outside the app container, directly under the page body', () => {
      const { container } = renderModal()
      const dialog = screen.getByRole('dialog')

      expect(container).not.toContainElement(dialog)
      // dialog -> backdrop -> body
      expect(dialog.parentElement.parentElement).toBe(document.body)
    })
  })

  describe('keeping the page behind it out of reach', () => {
    it('makes the app inert while open and reachable again once closed', () => {
      const { container, unmount } = renderModal()
      expect(container).toHaveAttribute('inert')

      unmount()

      expect(container).not.toHaveAttribute('inert')
    })

    it('never makes itself inert', () => {
      renderModal()

      const backdrop = screen.getByRole('dialog').parentElement

      expect(backdrop).not.toHaveAttribute('inert')
      expect(screen.getByRole('dialog')).not.toHaveAttribute('inert')
    })

    it('makes other elements on the page inert too, and restores them afterwards', () => {
      const bystander = addElementToPage()
      const { unmount } = renderModal()
      expect(bystander).toHaveAttribute('inert')

      unmount()

      expect(bystander).not.toHaveAttribute('inert')
    })

    it('leaves elements that were already inert alone', () => {
      const alreadyInert = addElementToPage({ inert: true })
      const { unmount } = renderModal()

      unmount()

      expect(alreadyInert).toHaveAttribute('inert')
    })

    it('keeps the page locked, and makes the first dialog usable again, when a second one on top closes', () => {
      const first = render(
        <Modal title={ TITLE } onClose={ vi.fn() }>
          <p>{ BODY_TEXT }</p>
        </Modal>
      )
      const firstDialog = screen.getByRole('dialog', { name: TITLE })
      const firstBackdrop = firstDialog.parentElement
      expect(firstBackdrop).not.toHaveAttribute('inert')

      const second = render(
        <Modal title={ OTHER_TITLE } onClose={ vi.fn() }>
          <p>{ BODY_TEXT }</p>
        </Modal>
      )
      // The second dialog now covers the first
      expect(firstBackdrop).toHaveAttribute('inert')

      second.unmount()

      expect(firstBackdrop).not.toHaveAttribute('inert')
      expect(first.container).toHaveAttribute('inert')
      expect(firstDialog).toHaveFocus()
    })

    it('makes the page reachable again before returning focus, because browsers refuse to focus inert elements', async () => {
      const { container } = render(<ModalWithOpener />)
      const openButton = button(OPEN_BUTTON_LABEL)
      await userEvent.click(openButton)

      let pageWasInertWhenFocusReturned = null
      const focusOpener = openButton.focus.bind(openButton)
      vi.spyOn(openButton, 'focus').mockImplementation((...args) => {
        pageWasInertWhenFocusReturned = container.hasAttribute('inert')
        focusOpener(...args)
      })

      await userEvent.keyboard('{Escape}')

      expect(pageWasInertWhenFocusReturned).toBe(false)
      expect(openButton).toHaveFocus()
    })
  })

  describe('keeping Tab inside', () => {
    it('wraps from the last control back to the first', () => {
      renderModalWithActions()
      button(SECOND_ACTION).focus()

      const leftToTheBrowser = pressTab()

      expect(leftToTheBrowser).toBe(false)
      expect(button(CLOSE_BUTTON)).toHaveFocus()
    })

    it('wraps Shift+Tab from the first control back to the last', () => {
      renderModalWithActions()
      button(CLOSE_BUTTON).focus()

      const leftToTheBrowser = pressTab({ shift: true })

      expect(leftToTheBrowser).toBe(false)
      expect(button(SECOND_ACTION)).toHaveFocus()
    })

    it('sends Shift+Tab from the dialog itself, where focus starts, to the last control', () => {
      renderModalWithActions()
      expect(screen.getByRole('dialog')).toHaveFocus()

      const leftToTheBrowser = pressTab({ shift: true })

      expect(leftToTheBrowser).toBe(false)
      expect(button(SECOND_ACTION)).toHaveFocus()
    })

    it('lets Tab from the dialog itself move into the first control on its own', () => {
      renderModalWithActions()
      expect(screen.getByRole('dialog')).toHaveFocus()

      expect(pressTab()).toBe(true)
    })

    it.each(TAB_LEFT_TO_THE_BROWSER_CASES)(
      'leaves $label to the browser',
      ({ control, shift }) => {
        renderModalWithActions()
        button(control).focus()

        expect(pressTab({ shift })).toBe(true)
      }
    )

    it('keeps focus on the only control when there is just one', () => {
      render(
        <Modal title={ TITLE } dismissible={ false }>
          <button>{ ONLY_ACTION }</button>
        </Modal>
      )
      button(ONLY_ACTION).focus()

      expect(pressTab()).toBe(false)
      expect(button(ONLY_ACTION)).toHaveFocus()
      expect(pressTab({ shift: true })).toBe(false)
      expect(button(ONLY_ACTION)).toHaveFocus()
    })

    it('keeps focus on the dialog when there is nothing to tab to', () => {
      renderModal({ dismissible: false })
      expect(screen.getByRole('dialog')).toHaveFocus()

      expect(pressTab()).toBe(false)
      expect(screen.getByRole('dialog')).toHaveFocus()
      expect(pressTab({ shift: true })).toBe(false)
      expect(screen.getByRole('dialog')).toHaveFocus()
    })
  })

  describe('focus and scrolling', () => {
    it('moves focus into the dialog when it opens', () => {
      renderModal()

      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    it('returns focus to the button that opened it when it closes', async () => {
      render(<ModalWithOpener />)
      const openButton = button(OPEN_BUTTON_LABEL)

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