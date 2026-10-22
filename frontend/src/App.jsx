import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Login from './pages/Login'
import { useEffect, useState } from 'react'
import Header from './components/Header'
const API_URL = import.meta.env.VITE_API_URL
function App () {
  const [status, setStatus] = useState('checking...')
  useEffect(() => {
    fetch(`${API_URL}/health`)
    .then((res) => res.json())
    .then((data) => setStatus(data.status))
    .catch(() => setStatus('offline'))
  }, [])
  return (
    <>
    <Header />
      <main>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/login" element={<Login />} />
        </Routes>
        <h1>LPG Leak Detection</h1>
        <p>Backend: {status}</p>
      </main>
    </>
   )
  }
  export default App

