import { useState } from 'react'
import { posterUrl } from '../lib/tmdb'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getMovieDetails, getTvDetails } from '../lib/tmdb'

export default function SearchResults({ results, onSelect, watchedMap, onMarkedWatched }) {
  const { user } = useAuth()
  const [markingId, setMarkingId] = useState(null)

  async function handleQuickWatch(e, item) {
    e.stopPropagation()
    if (!user || markingId) return

    const key = `${item.mediaType}-${item.id}`
    if (watchedMap[key]) return // already watched

    setMarkingId(key)
    try {
      const contentType = item.mediaType === 'movie' ? 'movie' : 'tv_show'
      const details = item.mediaType === 'movie'
        ? await getMovieDetails(item.id)
        : await getTvDetails(item.id)

      // Upsert content item
      const { data: contentItem, error: contentError } = await supabase
        .from('content_items')
        .upsert({
          content_type: contentType,
          external_id: String(item.id),
          title: item.title,
          poster_thumbnail_url: item.posterPath,
          year: item.year,
          metadata_json: details.metadata,
        }, { onConflict: 'external_id,content_type' })
        .select()
        .single()

      if (contentError) throw contentError

      // Get user's group
      const { data: membership } = await supabase
        .from('group_memberships')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) throw new Error('Not a member of any group.')

      // Create bare review (watched only)
      const { error: reviewError } = await supabase
        .from('reviews')
        .upsert({
          user_id: user.id,
          content_item_id: contentItem.id,
          group_id: membership.group_id,
          rating: null,
          short_take: null,
          watched_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id,content_item_id,group_id' })

      if (reviewError) throw reviewError

      // Cache streaming availability
      const providers = details.providers || []
      if (providers.length > 0) {
        await supabase
          .from('streaming_availability')
          .delete()
          .eq('content_item_id', contentItem.id)
        await supabase
          .from('streaming_availability')
          .insert(providers.map(p => ({
            content_item_id: contentItem.id,
            platform_name: p.name,
            platform_logo_url: p.logoPath,
            country: 'US',
          })))
      }

      onMarkedWatched?.(key)
    } catch (err) {
      console.error('Quick watch failed:', err)
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="search-results">
      {results.map(item => {
        const key = `${item.mediaType}-${item.id}`
        const isWatched = !!watchedMap[key]
        const isMarking = markingId === key
        const isYouTube = item.mediaType === 'youtube'

        return (
          <div key={key} className="search-result-item">
            <button
              className="search-result-main"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
            >
              <img
                src={posterUrl(item.posterPath, 'w92') || '/placeholder-poster.svg'}
                alt={item.title}
                className="search-result-poster"
              />
              <div className="search-result-info">
                <span className="search-result-title">{item.title}</span>
                <span className="search-result-meta">
                  {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                  {item.year ? ` · ${item.year}` : ''}
                </span>
              </div>
            </button>
            {!isYouTube && (
              <button
                className={`quick-watch-btn ${isWatched ? 'quick-watch-btn--watched' : ''}`}
                onClick={(e) => handleQuickWatch(e, item)}
                disabled={isWatched || isMarking}
                title={isWatched ? 'Already watched' : 'Mark as watched'}
                onMouseDown={(e) => e.preventDefault()}
              >
                {isMarking ? (
                  <span className="quick-watch-spinner">···</span>
                ) : isWatched ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
