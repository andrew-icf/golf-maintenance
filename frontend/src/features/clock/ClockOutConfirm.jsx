import { Modal } from '../../components/Modal'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import './ClockControl.css'

// Asks before clocking out, and says what happens next. It owns its own request, so each
// time it opens it starts fresh, with no leftover error. It closes itself when clocking out
// works, and cannot be dismissed while the request is on its way.
export function ClockOutConfirm({ logsOut, onClockOut, onClose }) {
  const clockOut = useAsyncAction(onClockOut, 'Could not clock out. Try again.')

  async function handleConfirm() {
    if (await clockOut.run()) {
      onClose()
    }
  }

  return (
    <Modal title="Clock out?" onClose={ onClose } dismissible={ !clockOut.isRunning }>
      <div className="clock-out-confirm">
        <p>{ logsOut ? 'You will be logged out.' : 'You can keep using the app.' }</p>
        { clockOut.error && <p role="alert" className="clock-control-error">{ clockOut.error }</p> }
        <div className="clock-out-confirm-actions">
          <button type="button" onClick={ onClose } disabled={ clockOut.isRunning }>
            Cancel
          </button>
          <button
            type="button"
            className="clock-out-confirm-button"
            onClick={ handleConfirm }
            disabled={ clockOut.isRunning }
          >
            { clockOut.isRunning ? 'Clocking out...' : 'Clock out' }
          </button>
        </div>
      </div>
    </Modal>
  )
}