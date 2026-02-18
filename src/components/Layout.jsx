import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SearchBar from './SearchBar'
import ReviewModal from './ReviewModal'
import ProfileModal from './ProfileModal'

function getInitialTheme() {
  const saved = localStorage.getItem('sr-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function Layout({ children }) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getInitialTheme)
  const [showLogOverlay, setShowLogOverlay] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sr-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.content = theme === 'dark' ? '#1a1915' : '#f5f1ec'
    }
  }, [theme])

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showProfileMenu])

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }


  async function handleSignOut() {
    setShowProfileMenu(false)
    await signOut()
    navigate('/login')
  }

  function handleSelectItem(item) {
    setSelectedItem(item)
    setShowLogOverlay(false)
  }

  function handleQuickWatched() {
    setShowLogOverlay(false)
    navigate('/feed', { state: { refresh: Date.now() } })
  }

  function handleReviewSaved() {
    setSelectedItem(null)
    setShowLogOverlay(false)
    navigate('/feed', { state: { refresh: Date.now() } })
  }

  function handleCloseAll() {
    setSelectedItem(null)
    setShowLogOverlay(false)
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="app-layout">
      <div className="landscape-blocker">
        <div className="landscape-blocker-icon">📱</div>
        <div className="landscape-blocker-text">Please rotate your device</div>
        <div className="landscape-blocker-sub">Screening Room works best in portrait mode</div>
      </div>

      <header className="app-header">
        <Link to="/" className="app-logo">Screening <span className="logo-accent">Room</span></Link>
        {user && (
          <div className="header-profile-wrap" ref={profileMenuRef}>
            <button
              className="header-profile-btn"
              onClick={() => setShowProfileMenu(prev => !prev)}
            >
              <div className={`header-profile-avatar ${profile?.avatar_url ? 'header-profile-avatar--emoji' : ''}`}>
                {profile?.avatar_url || (profile?.display_name || '?')[0].toUpperCase()}
              </div>
            </button>

            {showProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu-user">
                  <div className={`profile-menu-avatar ${profile?.avatar_url ? 'profile-menu-avatar--emoji' : ''}`}>
                    {profile?.avatar_url || (profile?.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="profile-menu-name">{profile?.display_name || 'User'}</div>
                    <div className="profile-menu-email">{profile?.email || ''}</div>
                  </div>
                </div>
                <div className="profile-menu-divider" />
                <button className="profile-menu-item" onClick={() => { setShowProfileMenu(false); navigate(`/profile/${user.id}`) }}>
                  <span className="profile-menu-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  View Profile
                </button>
                <button className="profile-menu-item" onClick={() => { setShowProfileMenu(false); setShowProfileModal(true) }}>
                  <span className="profile-menu-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </span>
                  Edit Profile
                </button>
                <button className="profile-menu-item" onClick={() => { toggleTheme(); setShowProfileMenu(false) }}>
                  <span className="profile-menu-item-icon">
                    {theme === 'light' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    )}
                  </span>
                  {theme === 'light' ? 'Dark mode' : 'Light mode'}
                </button>
                <button className="profile-menu-item profile-menu-item--danger" onClick={handleSignOut}>
                  <span className="profile-menu-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="app-main">
        {children}
      </main>

      {user && (
        <nav className="bottom-tabs">
          <Link
            to="/"
            className={`bottom-tab ${isActive('/') ? 'bottom-tab--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Home</span>
          </Link>

          <button
            className="bottom-tab bottom-tab--log"
            onClick={() => setShowLogOverlay(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="12" />
              <line x1="12" y1="7" x2="12" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="7" y1="12" x2="17" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Log</span>
          </button>

          <Link
            to="/feed"
            className={`bottom-tab ${isActive('/feed') ? 'bottom-tab--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>Feed</span>
          </Link>
        </nav>
      )}

      {showLogOverlay && (
        <div className="log-overlay">
          <div className="log-overlay-header">
            <h2>Log something</h2>
            <button className="log-overlay-close" onClick={() => setShowLogOverlay(false)}>
              Cancel
            </button>
          </div>
          <div className="log-overlay-search">
            <SearchBar onSelect={handleSelectItem} onQuickWatched={handleQuickWatched} />
          </div>
          <p className="log-overlay-hint">Search movies, TV shows, or paste a YouTube URL</p>
        </div>
      )}

      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          onClose={handleCloseAll}
          onSaved={handleReviewSaved}
        />
      )}

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  )
}
