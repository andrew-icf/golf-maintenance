import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../api'
import { createDeferred } from '../../test/helpers'
import { CURRENT_PASSWORD, FORM_CASES, NEW_PASSWORD } from '../../test/fixtures/passwordCases'
import {
  MINIMUM_LENGTH_HINT,
  MISSING_CURRENT_MESSAGE,
  NETWORK_MESSAGE,
  SUCCESS_TEXT,
  TOO_SHORT_MESSAGE,
  WRONG_CURRENT_MESSAGE,
} from '../../test/fixtures/passwordChangeCases'
import { ChangePasswordForm } from './ChangePasswordForm'

// Test data
const LABELS = {
  currentPassword: 'Current password',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
}
const FIELD_NAMES = ['currentPassword', 'newPassword', 'confirmPassword']
const VALID_FIELDS = {
  currentPassword: CURRENT_PASSWORD,
  newPassword: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
}
const SHORT_NEW_PASSWORD_FIELDS = {
  currentPassword: CURRENT_PASSWORD,
  newPassword: 'short',
  confirmPassword: 'short',
}
const EXPECTED_AUTOCOMPLETE = ['current-password', 'new-password', 'new-password']
const WRONG_CURRENT_PASSWORD_FAILURE = new ApiError('current password is incorrect', 403)
const DROPPED_CONNECTION = new TypeError('Failed to fetch')

// Actions
function renderForm({ onSubmit = vi.fn().mockResolvedValue(), onClose = vi.fn() } = {}) {
  const view = render(<ChangePasswordForm onSubmit={ onSubmit } onClose={ onClose } />)
  return { onSubmit, onClose, ...view }
}

function field(name) {
  return screen.getByLabelText(LABELS[name])
}

function submitButton() {
  return screen.getByRole('button', { name: /change(ing)? password/i })
}

// Fills fields in without typing each letter, and skips the ones left empty
function fillIn(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value !== '') {
      fireEvent.change(field(name), { target: { value } })
    }
  }
}

async function fillInAndSubmit(fields) {
  fillIn(fields)
  await userEvent.click(submitButton())
}

function invalidFields() {
  return document.querySelectorAll('[aria-invalid="true"]')
}

describe('ChangePasswordForm', () => {
  describe('what it shows', () => {
    it('opens with the cursor in the current password field', () => {
      renderForm()

      expect(field('currentPassword')).toHaveFocus()
    })

    it('shows the three fields, each with its label', () => {
      renderForm()

      expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument()
      for (const name of FIELD_NAMES) {
        expect(field(name)).toBeInTheDocument()
      }
    })

    it('tells the person the minimum length', () => {
      renderForm()

      expect(screen.getByText(MINIMUM_LENGTH_HINT)).toBeInTheDocument()
    })

    it('hides what is typed until Show passwords is checked', async () => {
      renderForm()
      for (const name of FIELD_NAMES) {
        expect(field(name)).toHaveAttribute('type', 'password')
      }

      await userEvent.click(screen.getByLabelText('Show passwords'))
      for (const name of FIELD_NAMES) {
        expect(field(name)).toHaveAttribute('type', 'text')
      }

      await userEvent.click(screen.getByLabelText('Show passwords'))
      for (const name of FIELD_NAMES) {
        expect(field(name)).toHaveAttribute('type', 'password')
      }
    })

    it('tells the browser which field is the current password and which are the new one', () => {
      renderForm()

      const hints = FIELD_NAMES.map((name) => field(name).getAttribute('autocomplete'))

      expect(hints).toEqual(EXPECTED_AUTOCOMPLETE)
    })
  })

  describe('checking before asking the server', () => {
    it.each(FORM_CASES)('reports $label', async ({ fields, expectedErrors, expectedValid }) => {
      const { onSubmit } = renderForm()
      const expectedMessages = Object.values(expectedErrors).filter(Boolean)

      await fillInAndSubmit(fields)

      for (const message of expectedMessages) {
        expect(screen.getByText(message)).toBeInTheDocument()
      }
      expect(invalidFields()).toHaveLength(expectedMessages.length)
      expect(onSubmit).toHaveBeenCalledTimes(expectedValid ? 1 : 0)
    })

    it('puts the cursor in the first field with a problem', async () => {
      renderForm()

      await fillInAndSubmit(SHORT_NEW_PASSWORD_FIELDS)

      expect(field('newPassword')).toHaveFocus()
    })

    it('takes a field\'s message away as soon as it is edited', async () => {
      renderForm()
      await userEvent.click(submitButton())
      expect(screen.getByText(MISSING_CURRENT_MESSAGE)).toBeInTheDocument()
      expect(screen.getByText(TOO_SHORT_MESSAGE)).toBeInTheDocument()

      await userEvent.type(field('currentPassword'), 'p')

      expect(screen.queryByText(MISSING_CURRENT_MESSAGE)).not.toBeInTheDocument()
      expect(screen.getByText(TOO_SHORT_MESSAGE)).toBeInTheDocument()
    })

    it('passes only the current and the new password on, never the confirmation', async () => {
      const { onSubmit } = renderForm()

      await fillInAndSubmit(VALID_FIELDS)

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith(CURRENT_PASSWORD, NEW_PASSWORD)
    })

    it('submits when Enter is pressed in a field', async () => {
      const { onSubmit } = renderForm()
      fillIn(VALID_FIELDS)

      await userEvent.type(field('confirmPassword'), '{Enter}')

      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe('while the request is on its way', () => {
    it('says it is changing the password, locks everything, and ignores a second press', async () => {
      const request = createDeferred()
      const { onSubmit } = renderForm({ onSubmit: vi.fn().mockReturnValue(request.promise) })

      await fillInAndSubmit(VALID_FIELDS)

      expect(screen.getByRole('button', { name: 'Changing password...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      for (const name of FIELD_NAMES) {
        expect(field(name)).toBeDisabled()
      }
      await userEvent.click(screen.getByRole('button', { name: 'Changing password...' }))
      expect(onSubmit).toHaveBeenCalledTimes(1)

      await act(async () => {
        request.resolve()
      })
    })

    it('cannot be closed with Escape', async () => {
      const request = createDeferred()
      const { onClose } = renderForm({ onSubmit: vi.fn().mockReturnValue(request.promise) })
      await fillInAndSubmit(VALID_FIELDS)

      await userEvent.keyboard('{Escape}')

      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument()

      await act(async () => {
        request.resolve()
      })
    })
  })

  describe('when the password is changed', () => {
    it('says so and offers Done, with the fields gone so no password stays on screen', async () => {
      renderForm()

      await fillInAndSubmit(VALID_FIELDS)

      expect(screen.getByRole('dialog', { name: 'Password changed' })).toBeInTheDocument()
      expect(screen.getByText(SUCCESS_TEXT)).toBeInTheDocument()
      expect(screen.queryByLabelText(LABELS.currentPassword)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(LABELS.newPassword)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    it('closes from Done', async () => {
      const { onClose } = renderForm()
      await fillInAndSubmit(VALID_FIELDS)

      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the change fails', () => {
    it('shows a wrong current password under that field, with the cursor there and the typing kept', async () => {
      renderForm({ onSubmit: vi.fn().mockRejectedValue(WRONG_CURRENT_PASSWORD_FAILURE) })

      await fillInAndSubmit(VALID_FIELDS)

      expect(screen.getByText(WRONG_CURRENT_MESSAGE)).toBeInTheDocument()
      expect(field('currentPassword')).toHaveAttribute('aria-invalid', 'true')
      expect(field('currentPassword')).toHaveFocus()
      expect(field('newPassword')).toHaveValue(NEW_PASSWORD)
      expect(field('confirmPassword')).toHaveValue(NEW_PASSWORD)
      expect(screen.queryByRole('dialog', { name: 'Password changed' })).not.toBeInTheDocument()
    })

    it('shows a failure that belongs to no field as an alert, keeping the typing', async () => {
      renderForm({ onSubmit: vi.fn().mockRejectedValue(DROPPED_CONNECTION) })

      await fillInAndSubmit(VALID_FIELDS)

      expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_MESSAGE)
      expect(invalidFields()).toHaveLength(0)
      expect(field('currentPassword')).toHaveValue(CURRENT_PASSWORD)
      expect(field('newPassword')).toHaveValue(NEW_PASSWORD)
    })

    it('can be tried again after a failure', async () => {
      const onSubmit = vi.fn().mockRejectedValueOnce(DROPPED_CONNECTION).mockResolvedValue()
      renderForm({ onSubmit })
      await fillInAndSubmit(VALID_FIELDS)
      await screen.findByRole('alert')

      await userEvent.click(submitButton())

      expect(screen.getByRole('dialog', { name: 'Password changed' })).toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalledTimes(2)
    })
  })

  describe('closing', () => {
    it('closes from Cancel without asking the server', async () => {
      const { onSubmit, onClose } = renderForm()

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('closes when Escape is pressed', async () => {
      const { onClose } = renderForm()

      await userEvent.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})