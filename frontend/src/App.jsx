import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './features/auth/AuthContext'
import { LoginForm } from './features/auth/LoginForm'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ClockPanel } from './features/clock/ClockPanel'
import { CourseView } from './features/course/CourseView'
import { NavBar } from './components/NavBar'
import { EquipmentView } from './features/equipment/EquipmentView'
import { ScheduleView } from './features/schedule/ScheduleView'

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
        {user && <NavBar />}
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/clock" replace /> : <LoginForm />}
          />
          <Route
            path="/clock"
            element={
              <ProtectedRoute>
                <ClockPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/course"
            element={
              <ProtectedRoute>
                <CourseView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipment"
            element={
              <ProtectedRoute>
                <EquipmentView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <ScheduleView />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to={user ? '/clock' : '/login'} replace />} />
        </Routes>
      </section>
    </main>
  )
}

export default App