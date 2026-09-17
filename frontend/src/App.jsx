import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './AuthContext'
import { LoginForm } from './components/LoginForm'
import { ClockPanel } from './components/ClockPanel'
import { CourseView } from './components/CourseView'
import { ProtectedRoute } from './components/ProtectedRoute'
import { NavBar } from './components/NavBar'
import { EquipmentView } from './components/EquipmentView'

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
          <Route path="*" element={<Navigate to={user ? '/clock' : '/login'} replace />} />
        </Routes>
      </section>
    </main>
  )
}

export default App