import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FAILURE_MESSAGE } from '../../test/fixtures/asyncActionCases'
import {
  ADMIN_OFF_THE_CLOCK,
  CHIP_NOW,
  CLOCKED_IN_STAFF,
  CLOCKED_IN_WITHOUT_START,
  CONFIRM_TEXT_CASES,
  STAFF_OFF_THE_CLOCK,
} from '../../test/fixtures/clockControlCases'
import { createDeferred } from '../../test/helpers'
import { ClockControl } from './ClockControl'

// Actions
function renderControl({
  user = CLOCKED_IN_STAFF,
  onClockIn = vi.fn().mockResolvedValue(),
  onClockOut = vi.fn().mockResolvedValue(),
} = {}) {
  const view = render(<ClockControl user={ user } onClockIn={ onClockIn } onClockOut={ onClockOut } />)
  return { onClockIn, onClockOut, ...view }
}

// Renders the control and opens the clock-out question
async function renderConfirming(options) {
  const view = renderControl(options)
  await userEvent.click(screen.getByRole('button', { name: 'Clock out' }))
  return view
}

// Both the page and the question have a Clock out button, so ask the question for its own
function confirmButton() {
  return within(screen.getByRole('dialog')).getByRole('button', { name: /clock(ing)? out/i })
}

function cancelButton() {
  return within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
}

describe('ClockControl', () => {
  beforeEach(() => {
    // Only Date is faked, so timers and promises keep working normally
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(CHIP_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('when on the clock', () => {
    it('shows how long the person has been on the clock', () => {
      renderControl()

      expect(screen.getByText('On the clock · 3h 12m')).toBeInTheDocument()
    })

    it('shows just "On the clock" when the start time is missing', () => {
      renderControl({ user: CLOCKED_IN_WITHOUT_START })

      expect(screen.getByText('On the clock')).toBeInTheDocument()
    })

    it('offers Clock out, and no Clock in', () => {
      renderControl()

      expect(screen.getByRole('button', { name: 'Clock out' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clock in' })).not.toBeInTheDocument()
    })

    it('does not ask for confirmation until Clock out is used', () => {
      renderControl()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it.each(CONFIRM_TEXT_CASES)('asks before clocking out, and tells $label what happens next', async ({ user, expected }) => {
      const { onClockOut } = await renderConfirming({ user })

      const dialog = screen.getByRole('dialog', { name: 'Clock out?' })

      expect(within(dialog).getByText(expected)).toBeInTheDocument()
      expect(onClockOut).not.toHaveBeenCalled()
    })

    it('closes without clocking out when Cancel is used', async () => {
      const { onClockOut } = await renderConfirming()

      await userEvent.click(cancelButton())

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(onClockOut).not.toHaveBeenCalled()
    })

    it('closes without clocking out when Escape is pressed', async () => {
      const { onClockOut } = await renderConfirming()

      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(onClockOut).not.toHaveBeenCalled()
    })

    it('clocks out once when confirmed, then closes', async () => {
      const { onClockOut } = await renderConfirming()

      await userEvent.click(confirmButton())

      expect(onClockOut).toHaveBeenCalledTimes(1)
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('says it is clocking out, and cannot be cancelled, while the request is on its way', async () => {
      const request = createDeferred()
      await renderConfirming({ onClockOut: vi.fn().mockReturnValue(request.promise) })

      await userEvent.click(confirmButton())

      expect(confirmButton()).toHaveTextContent('Clocking out...')
      expect(confirmButton()).toBeDisabled()
      expect(cancelButton()).toBeDisabled()
      await userEvent.keyboard('{Escape}')
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await act(async () => {
        request.resolve()
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows why it failed, stays open, and can be tried again', async () => {
      const { onClockOut } = await renderConfirming({
        onClockOut: vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)),
      })

      await userEvent.click(confirmButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE_MESSAGE)
      expect(screen.getByRole('dialog', { name: 'Clock out?' })).toBeInTheDocument()
      expect(confirmButton()).toBeEnabled()
      expect(confirmButton()).toHaveTextContent('Clock out')

      await userEvent.click(confirmButton())

      expect(onClockOut).toHaveBeenCalledTimes(2)
    })

    it('starts without the old error when it is opened again after a failure', async () => {
      await renderConfirming({ onClockOut: vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)) })
      await userEvent.click(confirmButton())
      await screen.findByRole('alert')
      await userEvent.click(cancelButton())

      await userEvent.click(screen.getByRole('button', { name: 'Clock out' }))

      expect(screen.getByRole('dialog', { name: 'Clock out?' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('closes the question, and does not bring it back, when the person is no longer clocked in', async () => {
      const { rerender, onClockIn, onClockOut } = await renderConfirming()

      rerender(<ClockControl user={ STAFF_OFF_THE_CLOCK } onClockIn={ onClockIn } onClockOut={ onClockOut } />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Not on the clock')).toBeInTheDocument()

      rerender(<ClockControl user={ CLOCKED_IN_STAFF } onClockIn={ onClockIn } onClockOut={ onClockOut } />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('when not on the clock', () => {
    it('says so, and offers Clock in with no Clock out', () => {
      renderControl({ user: ADMIN_OFF_THE_CLOCK })

      expect(screen.getByText('Not on the clock')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clock in' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clock out' })).not.toBeInTheDocument()
    })

    it('clocks in once when Clock in is used', async () => {
      const { onClockIn } = renderControl({ user: ADMIN_OFF_THE_CLOCK })

      await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

      expect(onClockIn).toHaveBeenCalledTimes(1)
    })

    it('says it is clocking in, and ignores a second tap, while the request is on its way', async () => {
      const request = createDeferred()
      const { onClockIn } = renderControl({
        user: ADMIN_OFF_THE_CLOCK,
        onClockIn: vi.fn().mockReturnValue(request.promise),
      })

      await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

      expect(screen.getByRole('button', { name: 'Clocking in...' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Clocking in...' }))
      expect(onClockIn).toHaveBeenCalledTimes(1)

      await act(async () => {
        request.resolve()
      })
      expect(screen.getByRole('button', { name: 'Clock in' })).toBeEnabled()
    })

    it('shows why it failed, and can be used again', async () => {
      renderControl({
        user: ADMIN_OFF_THE_CLOCK,
        onClockIn: vi.fn().mockRejectedValue(new Error(FAILURE_MESSAGE)),
      })

      await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE_MESSAGE)
      expect(screen.getByRole('button', { name: 'Clock in' })).toBeEnabled()
    })
  })
})