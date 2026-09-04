import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('http://localhost:8080/health')
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Backend unavailable'))
  }, [])

  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">Golf Maintenance</p>
        <h1>Hello, world!</h1>
        <p className="status">{message}</p>
      </section>
    </main>
  )
}

export default App
