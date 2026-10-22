import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.login(email, password)
      setToken(data.token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <input
        type="email"
        placeholder="EMAIL"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="PASSWORD"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default Login