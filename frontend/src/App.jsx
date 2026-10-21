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
        <h1>LPG Leak Detection</h1>
        <p>Backend: {status}</p>
      </main>
    </>
   )
  }
  export default App

