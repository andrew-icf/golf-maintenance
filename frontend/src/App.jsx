import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './components/layout/AppLayout'
import { LANDING_PATH } from './components/layout/navItems'
import { useAuth } from './features/auth/AuthContext'
import { LoginForm } from './features/auth/LoginForm'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ClockPanel } from './features/clock/ClockPanel'
import { CourseView } from './features/course/CourseView'
import { HoleDetailsView } from './features/course/HoleDetailsView'
import { HOLE_ROUTE_PATTERN } from './features/course/holePath'
import { EquipmentView } from './features/equipment/EquipmentView'
import { ScheduleView } from './features/schedule/ScheduleView'

// The centered card on the green background, used by the login and loading screens
function CenteredCard({ children }) {
  return (
    <main className="app-shell">
      <section className="card">{ children }</section>
    </main>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <CenteredCard>
        <p>Loading...</p>
      </CenteredCard>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={ LANDING_PATH } replace />
          ) : (
            <CenteredCard>
              <p className="eyebrow">Golf Maintenance</p>
              <LoginForm />
            </CenteredCard>
          )
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/schedule" element={ <ScheduleView /> } />
        <Route path="/course" element={ <CourseView /> } />
        <Route path={ HOLE_ROUTE_PATTERN } element={ <HoleDetailsView /> } />
        <Route path="/equipment" element={ <EquipmentView /> } />
        <Route path="/clock" element={ <ClockPanel /> } />
      </Route>

      <Route path="*" element={ <Navigate to={ user ? LANDING_PATH : '/login' } replace /> } />
    </Routes>
  )
}

export default App