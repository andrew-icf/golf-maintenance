import { useEffect, useId, useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { describePasswordChangeFailure } from './passwordChangeErrors'
import { MIN_PASSWORD_LENGTH, validatePasswordForm } from './passwordRules'
import './ChangePasswordForm.css'

const FIELDS = [
  { name: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
  {
    name: 'newPassword',
    label: 'New password',
    autoComplete: 'new-password',
    hint: `At least ${MIN_PASSWORD_LENGTH} characters.`,
  },
  { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
]

const EMPTY_VALUES = { currentPassword: '', newPassword: '', confirmPassword: '' }
const NO_ERRORS = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Asks for the current password and a new one, twice. It checks the new one against the rules
// before asking, and shows the server's refusal if there is one. onSubmit does the work, taking
// the current and new passwords, and throws when it fails. onClose is for Cancel, Done, and Escape.
export function ChangePasswordForm({ onSubmit, onClose }) {
  const idBase = useId()
  const inputRefs = useRef({})
  const [values, setValues] = useState(EMPTY_VALUES)
  const [fieldErrors, setFieldErrors] = useState(NO_ERRORS)
  const [generalError, setGeneralError] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  // Focus is asked for here and done after the render, because a field can't take focus while
  // it is still locked for the request that has just ended
  const [focusRequest, setFocusRequest] = useState({ name: null, count: 0 })

  useEffect(() => {
    if (focusRequest.name) {
      inputRefs.current[focusRequest.name]?.focus()
    }
  }, [focusRequest])

  // The dialog takes focus first, so the first field asks for it once the dialog has settled
  useEffect(() => {
    inputRefs.current.currentPassword?.focus()
  }, [])

  function requestFocusOnFirstProblem(errors) {
    const firstProblem = FIELDS.find((field) => errors[field.name])
    if (firstProblem) {
      setFocusRequest((current) => ({ name: firstProblem.name, count: current.count + 1 }))
    }
  }

  function handleChange(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setGeneralError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const { errors, isValid } = validatePasswordForm(values)
    setFieldErrors(errors)
    setGeneralError('')
    if (!isValid) {
      requestFocusOnFirstProblem(errors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values.currentPassword, values.newPassword)
      setValues(EMPTY_VALUES)
      setIsDone(true)
    } catch (failure) {
      const { field, message } = describePasswordChangeFailure(failure)
      if (field) {
        const errorsForField = { ...NO_ERRORS, [field]: message }
        setFieldErrors(errorsForField)
        requestFocusOnFirstProblem(errorsForField)
      } else {
        setGeneralError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isDone) {
    return (
      <Modal title="Password changed" onClose={ onClose }>
        <div className="change-password">
          <p>Your password was changed. Any other devices you were signed in on have been signed out.</p>
          <div className="change-password-actions">
            <button type="button" className="change-password-submit" onClick={ onClose }>
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Change password" onClose={ onClose } dismissible={ !isSubmitting }>
      <form className="change-password" onSubmit={ handleSubmit } noValidate>
        {FIELDS.map((field) => {
          const inputId = `${idBase}-${field.name}`
          const hintId = `${inputId}-hint`
          const errorId = `${inputId}-error`
          const error = fieldErrors[field.name]
          const describedBy = [field.hint && hintId, error && errorId].filter(Boolean).join(' ')

          return (
            <div key={ field.name } className="change-password-field">
              <label htmlFor={ inputId }>{ field.label }</label>
              <input
                id={ inputId }
                ref={ (element) => {
                  inputRefs.current[field.name] = element
                } }
                type={ showPasswords ? 'text' : 'password' }
                value={ values[field.name] }
                onChange={ (event) => handleChange(field.name, event.target.value) }
                autoComplete={ field.autoComplete }
                disabled={ isSubmitting }
                aria-invalid={ error ? 'true' : undefined }
                aria-describedby={ describedBy || undefined }
              />
              { field.hint && <p id={ hintId } className="change-password-hint">{ field.hint }</p> }
              { error && <p id={ errorId } className="change-password-error">{ error }</p> }
            </div>
          )
        })}

        <label className="change-password-show">
          <input
            type="checkbox"
            checked={ showPasswords }
            onChange={ (event) => setShowPasswords(event.target.checked) }
          />
          Show passwords
        </label>

        { generalError && <p role="alert" className="change-password-error">{ generalError }</p> }

        <div className="change-password-actions">
          <button type="button" onClick={ onClose } disabled={ isSubmitting }>
            Cancel
          </button>
          <button type="submit" className="change-password-submit" disabled={ isSubmitting }>
            { isSubmitting ? 'Changing password...' : 'Change password' }
          </button>
        </div>
      </form>
    </Modal>
  )
}