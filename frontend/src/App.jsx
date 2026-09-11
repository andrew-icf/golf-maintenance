import './App.css'
import { useAuth } from './AuthContext'
import { LoginForm } from './components/LoginForm'
import { ClockPanel } from './components/ClockPanel'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <p>Loading...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">Golf Maintenance</p>
        {user ? <ClockPanel /> : <LoginForm />}
      </section>
    </main>
  )
}

export default App