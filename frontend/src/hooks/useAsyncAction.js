import { useState } from 'react'

// For a button that calls the server and can fail. While the action runs, isRunning is true,
// so the button can be disabled and say what it is doing. If it fails, error holds a message
// to show, and it clears the next time the action runs. run never throws, so the caller
// doesn't need its own try and catch.
export function useAsyncAction(action, fallbackMessage = 'Something went wrong. Try again.') {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setError('')
    setIsRunning(true)
    try {
      await action()
    } catch (failure) {
      setError(failure?.message || fallbackMessage)
    } finally {
      setIsRunning(false)
    }
  }

  return { run, isRunning, error }
}