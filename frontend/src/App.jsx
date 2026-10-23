import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AddSensor from './pages/AddSensor'
import Profile from './pages/Profile'
import { ProtectedRoute, GuestRoute } from './auth/ProtectedRoute'

function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-sensor" element={<ProtectedRoute><AddSensor /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute redirectTo="/add-sensor"><Signup /></GuestRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default App