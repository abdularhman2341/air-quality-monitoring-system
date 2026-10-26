import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const [name, setName] = useState(user.name)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await updateProfile({ name })
      setMessage('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h1>Profile</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <button type="submit" disabled={saving || name.trim() === user.name}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <p>{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>

      <p>Email: {user.email}</p>
            {user.created_at && (
        <p>Member since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      )}

      <button onClick={logout}>Log Out</button>
    </section>
  )
}

export default Profile