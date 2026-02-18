import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import FeedItem from '../components/FeedItem'
import ReviewModal from '../components/ReviewModal'
import PullToRefresh from '../components/PullToRefresh'

const VIBE_TAGS = [
  'Feel-Good', 'Mind-Bending', 'Slow Burn', 'Binge-Worthy',
  'Watch With Kids', 'Date Night', 'Background Noise', 'Visually Stunning',
  'Hidden Gem', 'Overhyped', 'Emotional', 'Educational',
  'Sports', 'True Crime', 'Comfort Rewatch',
  'Short Film', 'Nature', 'Animated',
]

const CONTENT_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv_show', label: 'TV' },
  { value: 'youtube_video', label: 'YouTube' },
]

const RATING_OPTIONS = [
  { value: 'all', label: 'Any Rating' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5' },
]

export default function Feed() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [allGenres, setAllGenres] = useState([])
  const highlightReviewId = searchParams.get('review')
  const [filter, setFilter] = useState({
    contentType: 'all',
    userId: 'all',
    genre: 'all',
    tag: 'all',
    minRating: 'all',
  })
  const [selectedItem, setSelectedItem] = useState(null)
  const [editingReview, setEditingReview] = useState(null)
  const [expandedFilter, setExpandedFilter] = useState(null)
  const [groupAverages, setGroupAverages] = useState({})
  const [sortOrder, setSortOrder] = useState('newest')
  const [hideWatched, setHideWatched] = useState(() => localStorage.getItem('sr-hide-watched') === 'true')
  const [userWatchedIds, setUserWatchedIds] = useState(new Set())

  useEffect(() => {
    fetchMembers()
    fetchUserWatched()
  }, [])

  // Listen for hide-watched changes from the profile menu toggle
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'sr-hide-watched') {
        setHideWatched(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorage)
    // Also listen for custom event (same-tab changes)
    function handleCustom() {
      setHideWatched(localStorage.getItem('sr-hide-watched') === 'true')
    }
    window.addEventListener('sr-hide-watched-changed', handleCustom)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('sr-hide-watched-changed', handleCustom)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [filter, sortOrder, hideWatched])

  // Re-fetch when navigated here with a refresh signal (e.g. after saving a review)
  useEffect(() => {
    if (location.state?.refresh) {
      fetchUserWatched()
      fetchReviews()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [location.state?.refresh])

  // Scroll to highlighted review from query param
  useEffect(() => {
    if (!loading && highlightReviewId) {
      const el = document.getElementById(`review-${highlightReviewId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('feed-item--highlight')
        setTimeout(() => el.classList.remove('feed-item--highlight'), 2000)
        // Clear the param so it doesn't re-highlight on filter change
        setSearchParams({}, { replace: true })
      }
    }
  }, [loading, highlightReviewId])

  async function fetchUserWatched() {
    const { data } = await supabase
      .from('reviews')
      .select('content_item_id')
      .eq('user_id', user.id)

    if (data) {
      setUserWatchedIds(new Set(data.map(r => r.content_item_id)))
    }
  }

  async function fetchMembers() {
    const { data } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('is_approved', true)
      .order('display_name')

    if (data) {
      setMembers(data.map(u => ({
        id: u.id,
        name: u.display_name || 'Unknown',
      })))
    }
  }

  async function fetchReviews() {
    // Only show loading spinner on initial load, not filter changes
    if (reviews.length === 0) setLoading(true)

    let query = supabase
      .from('reviews')
      .select(`
        *,
        users ( display_name, avatar_url ),
        content_items ( *, streaming_availability ( id, platform_name, platform_logo_url ) ),
        tags ( id, tag )
      `)
      .order('created_at', { ascending: sortOrder === 'oldest' })
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

      // Always hide bare "watched only" entries (no rating, no take, no tags)
      filtered = filtered.filter(r =>
        r.rating !== null || r.short_take || (r.tags && r.tags.length > 0)
      )

      // Hide content the current user has already watched
      if (hideWatched && userWatchedIds.size > 0) {
        filtered = filtered.filter(r => !userWatchedIds.has(r.content_item_id))
      }

      // Collect unique genres for the filter dropdown
      const genreSet = new Set()
      data.forEach(r => {
        const genres = r.content_items?.metadata_json?.genres || []
        genres.forEach(g => genreSet.add(g))
      })
      setAllGenres([...genreSet].sort())

      // Compute group averages per content item (from all reviews, not filtered)
      const avgMap = {}
      data.forEach(r => {
        if (!r.content_item_id || r.rating == null) return
        if (!avgMap[r.content_item_id]) {
          avgMap[r.content_item_id] = { sum: 0, count: 0 }
        }
        avgMap[r.content_item_id].sum += r.rating
        avgMap[r.content_item_id].count += 1
      })
      const averages = {}
      for (const [id, { sum, count }] of Object.entries(avgMap)) {
        if (count >= 2) {
          averages[id] = { avg: sum / count / 2, count }
        }
      }
      setGroupAverages(averages)

      setReviews(filtered)
    }
    setLoading(false)
  }

  function updateFilter(key, value) {
    setFilter(prev => ({ ...prev, [key]: value }))
    setExpandedFilter(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleFilterCategory(category) {
    setExpandedFilter(prev => prev === category ? null : category)
  }

  function getFilterLabel(key) {
    switch (key) {
      case 'contentType':
        return CONTENT_TYPES.find(c => c.value === filter.contentType)?.label || 'Type'
      case 'userId': {
        if (filter.userId === 'all') return 'Person'
        return members.find(m => m.id === filter.userId)?.name || 'Person'
      }
      case 'genre':
        return filter.genre === 'all' ? 'Genre' : filter.genre
      case 'tag':
        return filter.tag === 'all' ? 'Vibe' : filter.tag
      case 'minRating':
        return filter.minRating === 'all' ? 'Rating' : `${filter.minRating}+`
      default:
        return ''
    }
  }

  function isFilterActive(key) {
    return filter[key] !== 'all'
  }

  function handleEditReview(review) {
    const content = review.content_items
    const isYouTube = content?.content_type === 'youtube_video'

    const item = {
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
    }

    setSelectedItem(item)
    setEditingReview(review)
  }

  function handleModalClose() {
    setSelectedItem(null)
    setEditingReview(null)
  }

  function handleSaved() {
    setSelectedItem(null)
    setEditingReview(null)
    fetchReviews()
  }

  function getFilterSheetTitle(key) {
    switch (key) {
      case 'contentType': return 'Content Type'
      case 'userId': return 'Person'
      case 'genre': return 'Genre'
      case 'tag': return 'Vibe Tag'
      case 'minRating': return 'Minimum Rating'
      default: return ''
    }
  }

  function getFilterOptions(key) {
    switch (key) {
      case 'contentType':
        return CONTENT_TYPES.map(ct => ({ value: ct.value, label: ct.label }))
      case 'userId':
        return [
          { value: 'all', label: 'All' },
          ...members.map(m => ({ value: m.id, label: m.name })),
        ]
      case 'genre':
        return [
          { value: 'all', label: 'All' },
          ...allGenres.map(g => ({ value: g, label: g })),
        ]
      case 'tag':
        return [
          { value: 'all', label: 'All' },
          ...VIBE_TAGS.map(t => ({ value: t, label: t })),
        ]
      case 'minRating':
        return RATING_OPTIONS.map(r => ({ value: r.value, label: r.label }))
      default:
        return []
    }
  }

  function getFilterValue(key) {
    return filter[key]
  }

  async function refreshAll() {
    await Promise.all([fetchReviews(), fetchUserWatched(), fetchMembers()])
  }

  return (
    <div className="feed-page">
      <PullToRefresh onRefresh={refreshAll}>
      {/* Sticky filter chip bar */}
      <div className="feed-filters-sticky">
      <div className="feed-filters">
        <button
          className={`filter-chip filter-chip--sort`}
          onClick={(e) => { e.currentTarget.blur(); setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest') }}
        >
          {sortOrder === 'newest' ? '\u2193 Newest' : '\u2191 Oldest'}
        </button>
        {['contentType', 'userId', 'genre', 'tag', 'minRating'].map(key => (
          <button
            key={key}
            className={`filter-chip ${isFilterActive(key) ? 'filter-chip--active' : ''}`}
            onClick={(e) => { e.currentTarget.blur(); isFilterActive(key) ? updateFilter(key, 'all') : toggleFilterCategory(key) }}
          >
            {getFilterLabel(key)}
            {isFilterActive(key) && ' \u00d7'}
          </button>
        ))}
        <button
          className={`filter-chip ${hideWatched ? 'filter-chip--active' : ''}`}
          onClick={(e) => {
            e.currentTarget.blur()
            const next = !hideWatched
            setHideWatched(next)
            localStorage.setItem('sr-hide-watched', String(next))
            window.dispatchEvent(new Event('sr-hide-watched-changed'))
          }}
        >
          Hide Watched
        </button>
      </div>
      </div>

      {/* Filter bottom sheet */}
      {expandedFilter && (
        <div className="filter-sheet-overlay" onClick={() => setExpandedFilter(null)}>
          <div className="filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="filter-sheet-handle" />
            <h3 className="filter-sheet-title">{getFilterSheetTitle(expandedFilter)}</h3>
            <div className="filter-sheet-options">
              {getFilterOptions(expandedFilter).map(opt => (
                <button
                  key={opt.value}
                  className={`filter-sheet-option ${getFilterValue(expandedFilter) === opt.value ? 'filter-sheet-option--active' : ''}`}
                  onClick={() => updateFilter(expandedFilter, opt.value)}
                >
                  {opt.label}
                  {getFilterValue(expandedFilter) === opt.value && (
                    <span className="filter-sheet-check">{'\u2713'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && <p className="feed-loading">Loading feed...</p>}

      {!loading && reviews.length === 0 && (
        <div className="feed-empty">
          <p>No reviews yet. Be the first to log something!</p>
        </div>
      )}

      <div className="feed-list" key={JSON.stringify(filter)}>
        {reviews.map(review => (
          <FeedItem
            key={review.id}
            review={review}
            onEdit={handleEditReview}
            groupAvg={groupAverages[review.content_item_id]}
            isWatchedByUser={userWatchedIds.has(review.content_item_id)}
            onMarkedWatched={(contentItemId, watched) => {
              setUserWatchedIds(prev => {
                const next = new Set(prev)
                if (watched) next.add(contentItemId)
                else next.delete(contentItemId)
                return next
              })
            }}
          />
        ))}
      </div>

      <div className="tmdb-attribution">
        <img
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
          alt="TMDB"
          className="tmdb-logo"
        />
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </div>

      </PullToRefresh>

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
