import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import SearchBar from '../components/SearchBar'
import ReviewModal from '../components/ReviewModal'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const TAGLINES = [
  'What did you watch?',
  'Seen anything good?',
  'What are we watching?',
  'Log your latest watch.',
]

const TYPE_ICONS = {
  movie: '\uD83C\uDFAC',
  tv_show: '\uD83D\uDCFA',
  youtube_video: '\u25B6\uFE0F',
}

export default function Home() {
  const [selectedItem, setSelectedItem] = useState(null)
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [recentActivity, setRecentActivity] = useState([])
  const [stats, setStats] = useState(null)
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)])

  useEffect(() => {
    fetchRecentActivity()
    fetchStats()
  }, [])

  async function fetchRecentActivity() {
    const { data } = await supabase
      .from('reviews')
      .select(`
        id, rating, created_at, user_id,
        users ( display_name ),
        content_items ( title, content_type )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) setRecentActivity(data)
  }

  async function fetchStats() {
    const { count: totalReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })

    const { count: myReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: totalMembers } = await supabase
      .from('group_memberships')
      .select('*', { count: 'exact', head: true })

    setStats({
      totalReviews: totalReviews || 0,
      myReviews: myReviews || 0,
      totalMembers: totalMembers || 0,
    })
  }

  function handleSaved() {
    setSelectedItem(null)
    navigate('/feed')
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="home-page">
      <div className="home-content">
        <section className="home-hero">
          <p className="home-greeting">{getGreeting()}, {firstName}</p>
          <h1>{tagline}</h1>
          <SearchBar onSelect={setSelectedItem} />
        </section>

        {stats && (
          <div className="home-stats">
            <div className="home-stat">
              <span className="home-stat-number">{stats.myReviews}</span>
              <span className="home-stat-label">Your logs</span>
            </div>
            <div className="home-stat-divider" />
            <div className="home-stat">
              <span className="home-stat-number">{stats.totalReviews}</span>
              <span className="home-stat-label">Group logs</span>
            </div>
            <div className="home-stat-divider" />
            <div className="home-stat">
              <span className="home-stat-number">{stats.totalMembers}</span>
              <span className="home-stat-label">Members</span>
            </div>
          </div>
        )}

        {recentActivity.length > 0 && (
          <section className="home-recent">
            <h2 className="home-recent-title">Recent activity</h2>
            <div className="home-recent-list">
              {recentActivity.map(r => (
                <div key={r.id} className="home-recent-card" onClick={() => navigate(`/feed?review=${r.id}`)}>
                  <span className="home-recent-icon">
                    {TYPE_ICONS[r.content_items?.content_type] || '\uD83C\uDFAC'}
                  </span>
                  <div className="home-recent-info">
                    <span className="home-recent-content">{r.content_items?.title}</span>
                    <span className="home-recent-sub">
                      <Link
                        to={`/profile/${r.user_id}`}
                        className="home-recent-user-link"
                        onClick={e => e.stopPropagation()}
                      >
                        {r.users?.display_name}
                      </Link>
                      {r.rating && <span className="home-recent-stars">{' \u2605 '}{(r.rating / 2).toFixed(1)}</span>}
                      {' \u00B7 '}{timeAgo(r.created_at)}
                    </span>
                  </div>
                  <span className="home-recent-arrow">{'\u203A'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
