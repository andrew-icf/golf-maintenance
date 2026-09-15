import { useState } from 'react'
import './App.css'
import { useAuth } from './AuthContext'
import { LoginForm } from './components/LoginForm'
import { ClockPanel } from './components/ClockPanel'
import { CourseView } from './components/CourseView'

function App() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('clock')

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
        {user ? (
          <>
            <div className="tab-switch">
              <button
                className={tab === 'clock' ? 'active' : ''}
                onClick={() => setTab('clock')}
              >
                Clock
              </button>
              <button
                className={tab === 'course' ? 'active' : ''}
                onClick={() => setTab('course')}
              >
                Course
              </button>
            </div>
            {tab === 'clock' ? <ClockPanel /> : <CourseView />}
          </>
        ) : (
          <LoginForm />
        )}
      </section>
    </main>
  )
}

export default App