import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import FeedItem from '../components/FeedItem'

export default function Feed() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ contentType: 'all' })

  useEffect(() => {
    fetchReviews()
  }, [filter])

  async function fetchReviews() {
    setLoading(true)

    let query = supabase
      .from('reviews')
      .select(`
        *,
        users ( display_name, avatar_url ),
        content_items ( * ),
        tags ( id, tag )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter.contentType !== 'all') {
      query = query.eq('content_items.content_type', filter.contentType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch feed:', error)
    } else {
      // Filter out reviews where content_items is null (from content_type filter)
      setReviews(filter.contentType === 'all' ? data : data.filter(r => r.content_items))
    }
    setLoading(false)
  }

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1>Group Feed</h1>
        <div className="feed-filters">
          <select
            value={filter.contentType}
            onChange={e => setFilter({ ...filter, contentType: e.target.value })}
          >
            <option value="all">All Content</option>
            <option value="movie">Movies</option>
            <option value="tv_show">TV Shows</option>
            <option value="youtube_video">YouTube</option>
          </select>
        </div>
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
