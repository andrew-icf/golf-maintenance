import { useState } from 'react'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useNow } from '../../hooks/useNow'
import { ClockOutConfirm } from './ClockOutConfirm'
import { formatElapsed } from './clockElapsed'
import { logsOutOnClockOut } from './clockStatus'
import './ClockControl.css'

// Each form keeps its own state, so the clock-out question can't outlive being on the clock
function OnTheClock({ user, onClockOut }) {
  const now = useNow()
  const [isConfirming, setIsConfirming] = useState(false)
  const elapsed = formatElapsed(user.clocked_in_since, now)

  return (
    <div className="clock-control">
      <p className="clock-control-status">{ elapsed ? `On the clock · ${elapsed}` : 'On the clock' }</p>
      <button type="button" className="clock-control-button" onClick={ () => setIsConfirming(true) }>
        Clock out
      </button>
      { isConfirming && (
        <ClockOutConfirm
          logsOut={ logsOutOnClockOut(user) }
          onClockOut={ onClockOut }
          onClose={ () => setIsConfirming(false) }
        />
      )}
    </div>
  )
}

function OffTheClock({ onClockIn }) {
  const clockIn = useAsyncAction(onClockIn, 'Could not clock in. Try again.')

  return (
    <div className="clock-control">
      <p className="clock-control-status">Not on the clock</p>
      <button
        type="button"
        className="clock-control-button"
        onClick={ clockIn.run }
        disabled={ clockIn.isRunning }
      >
        { clockIn.isRunning ? 'Clocking in...' : 'Clock in' }
      </button>
      { clockIn.error && <p role="alert" className="clock-control-error">{ clockIn.error }</p> }
    </div>
  )
}

// The top bar's clock control: how long the person has been on the clock and a way to clock
// out, after a confirmation, or, when they are not on the clock, a way to clock in. Staff only
// meet the second form briefly, since the clock-in screen holds them until they are on the
// clock, but admins can use it whenever they like. onClockIn and onClockOut do the work and
// throw when they fail.
export function ClockControl({ user, onClockIn, onClockOut }) {
  return user.clocked_in === true ? (
    <OnTheClock user={ user } onClockOut={ onClockOut } />
  ) : (
    <OffTheClock onClockIn={ onClockIn } />
  )
}