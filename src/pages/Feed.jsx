import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import FeedItem from '../components/FeedItem'

const VIBE_TAGS = [
  'Feel-Good', 'Mind-Bending', 'Slow Burn', 'Binge-Worthy',
  'Watch With Kids', 'Date Night', 'Background Noise', 'Visually Stunning',
  'Hidden Gem', 'Overhyped', 'Emotional', 'Educational',
  'Sports', 'True Crime', 'Comfort Rewatch',
  'Short Film', 'Nature', 'Animated',
]

export default function Feed() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [allGenres, setAllGenres] = useState([])
  const [filter, setFilter] = useState({
    contentType: 'all',
    userId: 'all',
    genre: 'all',
    tag: 'all',
    minRating: 'all',
  })

  useEffect(() => {
    fetchMembers()
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [filter])

  async function fetchMembers() {
    const { data: membership } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) return

    const { data } = await supabase
      .from('group_memberships')
      .select('user_id, users ( display_name )')
      .eq('group_id', membership.group_id)

    if (data) {
      setMembers(data.map(m => ({
        id: m.user_id,
        name: m.users?.display_name || 'Unknown',
      })))
    }
  }

  async function fetchReviews() {
    setLoading(true)

    let query = supabase
      .from('reviews')
      .select(`
        *,
        users ( display_name, avatar_url ),
        content_items ( *, streaming_availability ( id, platform_name, platform_logo_url ) ),
        tags ( id, tag )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter.contentType !== 'all') {
      query = query.eq('content_items.content_type', filter.contentType)
    }

    if (filter.userId !== 'all') {
      query = query.eq('user_id', filter.userId)
    }

    if (filter.minRating !== 'all') {
      query = query.gte('rating', parseInt(filter.minRating) * 2)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch feed:', error)
      setReviews([])
    } else {
      let filtered = data

      // Client-side filter: content_type creates null content_items
      if (filter.contentType !== 'all') {
        filtered = filtered.filter(r => r.content_items)
      }

      // Client-side filter: genre (stored in metadata_json.genres array)
      if (filter.genre !== 'all') {
        filtered = filtered.filter(r =>
          r.content_items?.metadata_json?.genres?.includes(filter.genre)
        )
      }

      // Client-side filter: vibe tag
      if (filter.tag !== 'all') {
        filtered = filtered.filter(r =>
          r.tags?.some(t => t.tag === filter.tag)
        )
      }

      // Collect unique genres for the filter dropdown
      const genreSet = new Set()
      data.forEach(r => {
        const genres = r.content_items?.metadata_json?.genres || []
        genres.forEach(g => genreSet.add(g))
      })
      setAllGenres([...genreSet].sort())

      setReviews(filtered)
    }
    setLoading(false)
  }

  function updateFilter(key, value) {
    setFilter(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1>Group Feed</h1>
      </div>

      <div className="feed-filters">
        <select
          value={filter.contentType}
          onChange={e => updateFilter('contentType', e.target.value)}
        >
          <option value="all">All Content</option>
          <option value="movie">Movies</option>
          <option value="tv_show">TV Shows</option>
          <option value="youtube_video">YouTube</option>
        </select>

        <select
          value={filter.userId}
          onChange={e => updateFilter('userId', e.target.value)}
        >
          <option value="all">All People</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={filter.genre}
          onChange={e => updateFilter('genre', e.target.value)}
        >
          <option value="all">All Genres</option>
          {allGenres.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          value={filter.tag}
          onChange={e => updateFilter('tag', e.target.value)}
        >
          <option value="all">All Tags</option>
          {VIBE_TAGS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={filter.minRating}
          onChange={e => updateFilter('minRating', e.target.value)}
        >
          <option value="all">Any Rating</option>
          <option value="1">1+ Stars</option>
          <option value="2">2+ Stars</option>
          <option value="3">3+ Stars</option>
          <option value="4">4+ Stars</option>
          <option value="5">5 Stars</option>
        </select>
      </div>

      {loading && <p className="feed-loading">Loading feed...</p>}

      {!loading && reviews.length === 0 && (
        <div className="feed-empty">
          <p>No reviews yet. Be the first to log something!</p>
        </div>
      )}

      <div className="feed-list">
        {reviews.map(review => (
          <FeedItem key={review.id} review={review} />
        ))}
      </div>
    </div>
  )
}
