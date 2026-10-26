import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(name, email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create account</h1>
      <input
        type="text"
        placeholder="NAME"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        required
      />
      <input
        type="email"
        placeholder="EMAIL"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="PASSWORD (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        maxLength={72}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Sign up'}
      </button>
      {error && <p role="alert">{error}</p>}
      <p>Already have an account? <Link to="/login">Sign in</Link></p>
    </form>
  )
}

export default Signup