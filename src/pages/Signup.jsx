import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite')

  // Block access without a valid invite code
  if (!inviteCode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Screening Room</h1>
          <p className="auth-subtitle">This is a private, invite-only app.</p>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            You need an invite link to sign up. Ask someone who's already a member.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'block', textAlign: 'center' }}>
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verify invite code is valid before creating the account
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (groupError || !group) {
        setError('Invalid invite code.')
        setLoading(false)
        return
      }

      await signUp(email, password, displayName)

      // Wait briefly for the auth trigger to create the user profile
      await new Promise(r => setTimeout(r, 1000))

      // Get the newly created user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Signup succeeded but could not retrieve user.')

      // Approve the user and join the group
      await supabase
        .from('users')
        .update({ is_approved: true })
        .eq('id', user.id)

      await supabase
        .from('group_memberships')
        .insert({ user_id: user.id, group_id: group.id, role: 'member' })

      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>You're in!</h1>
          <p>Your account has been created.</p>
          <Link to="/" className="btn btn-primary">Go to Screening Room</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Screening Room</h1>
        <p className="auth-subtitle">You've been invited! Create your account.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              placeholder="How your friends will see you"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
