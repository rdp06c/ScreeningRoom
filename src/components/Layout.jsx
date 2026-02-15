import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="app-logo">Screening Room</Link>
        {user && (
          <nav className="app-nav">
            <Link to="/">Home</Link>
            <Link to="/feed">Feed</Link>
            <button onClick={handleSignOut} className="btn-link">
              Sign Out ({profile?.display_name || 'User'})
            </button>
          </nav>
        )}
      </header>

      <main className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        <div className="tmdb-attribution">
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
            alt="TMDB"
            className="tmdb-logo"
          />
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
      </footer>
    </div>
  )
}
