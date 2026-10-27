import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AuthLayout from './components/AuthLayout'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AddSensor from './pages/AddSensor'
import Profile from './pages/Profile'
import { ProtectedRoute, GuestRoute } from './auth/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><AuthLayout><Login /></AuthLayout></GuestRoute>} />
      <Route
        path="/signup"
        element={<GuestRoute redirectTo="/add-sensor"><AuthLayout><Signup /></AuthLayout></GuestRoute>}
      />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-sensor" element={<AddSensor />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<History />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
