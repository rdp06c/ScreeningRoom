import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProfileReviewCard from '../components/ProfileReviewCard'
import ReviewModal from '../components/ReviewModal'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Top Rated' },
  { value: 'lowest', label: 'Low Rated' },
]

export default function Profile() {
  const { userId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwnProfile = user?.id === userId

  const [profileUser, setProfileUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [contentType, setContentType] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')

  // Edit modal
  const [selectedItem, setSelectedItem] = useState(null)
  const [editingReview, setEditingReview] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [userId])

  async function fetchProfile() {
    setLoading(true)

    const [userRes, reviewsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url, created_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('reviews')
        .select(`
          *,
          content_items ( *, streaming_availability ( id, platform_name, platform_logo_url ) ),
          tags ( id, tag )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (userRes.data) setProfileUser(userRes.data)
    if (reviewsRes.data) setReviews(reviewsRes.data)
    setLoading(false)
  }

  // Computed stats
  const totalWatched = reviews.length
  const rated = reviews.filter(r => r.rating !== null)
  const watchedOnly = reviews.filter(r =>
    r.rating === null && !r.short_take && (!r.tags || r.tags.length === 0)
  )
  const avgRating = rated.length > 0
    ? (rated.reduce((sum, r) => sum + r.rating, 0) / rated.length / 2).toFixed(1)
    : null

  const typeCounts = reviews.reduce((acc, r) => {
    const type = r.content_items?.content_type
    if (type) acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  // Top vibe tags
  const tagCounts = {}
  reviews.forEach(r => {
    r.tags?.forEach(t => {
      tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)

  // Filter and sort
  let filtered = [...reviews]
  if (contentType !== 'all') {
    filtered = filtered.filter(r => r.content_items?.content_type === contentType)
  }
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at)
      case 'highest':
        return (b.rating ?? -1) - (a.rating ?? -1)
      case 'lowest':
        return (a.rating ?? 11) - (b.rating ?? 11)
      default: // newest
        return new Date(b.created_at) - new Date(a.created_at)
    }
  })

  function handleCardClick(review) {
    if (isOwnProfile) {
      const content = review.content_items
      const isYouTube = content?.content_type === 'youtube_video'
      setSelectedItem({
        id: content.external_id,
        title: content.title,
        year: content.year,
        mediaType: isYouTube ? 'youtube' : content.content_type === 'movie' ? 'movie' : 'tv',
        posterPath: isYouTube ? null : content.poster_thumbnail_url,
        thumbnailUrl: isYouTube ? content.poster_thumbnail_url : null,
        channelName: content.metadata_json?.channelName,
        duration: content.metadata_json?.duration,
        description: content.metadata_json?.description,
        publishedAt: content.metadata_json?.publishedAt,
      })
      setEditingReview(review)
    } else {
      navigate(`/feed?review=${review.id}`)
    }
  }

  function handleModalClose() {
    setSelectedItem(null)
    setEditingReview(null)
  }

  function handleSaved() {
    setSelectedItem(null)
    setEditingReview(null)
    fetchProfile()
  }

  if (loading) {
    return <div className="feed-loading">Loading profile...</div>
  }

  if (!profileUser) {
    return <div className="feed-empty"><p>User not found.</p></div>
  }

  const memberSince = new Date(profileUser.created_at).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="profile-page">
      {/* Profile header */}
      <div className="profile-header">
        <div className={`profile-avatar ${profileUser.avatar_url ? 'profile-avatar--emoji' : ''}`}>
          {profileUser.avatar_url || (profileUser.display_name || '?')[0].toUpperCase()}
        </div>
        <h1 className="profile-name">{profileUser.display_name || 'Unknown'}</h1>
        <p className="profile-since">Member since {memberSince}</p>
      </div>

      {/* Stats */}
      <div className="home-stats profile-stats">
        <div className="home-stat">
          <span className="home-stat-number">{totalWatched}</span>
          <span className="home-stat-label">Logged</span>
        </div>
        <div className="home-stat-divider" />
        <div className="home-stat">
          <span className="home-stat-number">{rated.length}</span>
          <span className="home-stat-label">Rated</span>
        </div>
        <div className="home-stat-divider" />
        <div className="home-stat">
          <span className="home-stat-number">{watchedOnly.length}</span>
          <span className="home-stat-label">Watched Only</span>
        </div>
        <div className="home-stat-divider" />
        <div className="home-stat">
          <span className="home-stat-number">{avgRating ? `${avgRating}\u2605` : '\u2014'}</span>
          <span className="home-stat-label">Avg Rating</span>
        </div>
      </div>

      {/* Content type breakdown */}
      {totalWatched > 0 && (
        <div className="profile-type-pills">
          {typeCounts.movie && (
            <span className="profile-type-pill profile-type-pill--movie">Movies: {typeCounts.movie}</span>
          )}
          {typeCounts.tv_show && (
            <span className="profile-type-pill profile-type-pill--tv">TV: {typeCounts.tv_show}</span>
          )}
          {typeCounts.youtube_video && (
            <span className="profile-type-pill profile-type-pill--youtube">YouTube: {typeCounts.youtube_video}</span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="profile-filters">
        <div className="feed-filters">
          <button
            className="filter-chip filter-chip--sort profile-sort-chip"
            onClick={(e) => {
              e.currentTarget.blur()
              const idx = SORT_OPTIONS.findIndex(s => s.value === sortOrder)
              setSortOrder(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].value)
            }}
          >
            {sortOrder === 'oldest' ? '\u2191' : '\u2193'} {SORT_OPTIONS.find(s => s.value === sortOrder)?.label}
          </button>
          {[
            { key: 'all', label: 'All' },
            { key: 'movie', label: 'Movies' },
            { key: 'tv_show', label: 'TV' },
            { key: 'youtube_video', label: 'YouTube' },
          ].map(opt => (
            <button
              key={opt.key}
              className={`filter-chip ${contentType === opt.key ? 'filter-chip--active' : ''}`}
              onClick={() => setContentType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Review list */}
      {filtered.length === 0 && (
        <div className="feed-empty">
          <p>No reviews match these filters.</p>
        </div>
      )}

      <div className="profile-review-list">
        {filtered.map(review => (
          <ProfileReviewCard
            key={review.id}
            review={review}
            onClick={() => handleCardClick(review)}
          />
        ))}
      </div>

      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          existingReview={editingReview}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
