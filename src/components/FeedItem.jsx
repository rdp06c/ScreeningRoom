import { useState } from 'react'
import { Link } from 'react-router-dom'
import { posterUrl, providerLogoUrl, getMovieDetails, getTvDetails } from '../lib/tmdb'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import StarRating from './StarRating'

function isBareWatched(review) {
  return review.rating === null
    && !review.short_take
    && (!review.tags || review.tags.length === 0)
}

export default function FeedItem({ review, onEdit, groupAvg, isWatchedByUser, onMarkedWatched }) {
  const { user } = useAuth()
  const displayRating = review.rating ? review.rating / 2 : null
  const content = review.content_items
  const isYouTube = content?.content_type === 'youtube_video'
  const mediaTypeClass = isYouTube ? 'youtube' : content?.content_type === 'movie' ? 'movie' : 'tv'
  const genres = content?.metadata_json?.genres || []
  const rawStreaming = content?.streaming_availability || []
  const streaming = rawStreaming.filter((s, i, arr) =>
    arr.findIndex(x => x.platform_name === s.platform_name) === i
  )
  const isOwn = user?.id === review.user_id
  const bare = isBareWatched(review)
  const [marking, setMarking] = useState(false)

  const contentTypeLabel = isYouTube
    ? 'YouTube'
    : content?.content_type === 'movie' ? 'Movie' : 'TV Show'

  const imgSrc = isYouTube
    ? content?.poster_thumbnail_url
    : posterUrl(content?.poster_thumbnail_url, 'w92')

  async function handleMarkWatched(e) {
    e.stopPropagation()
    if (marking || isOwn) return
    setMarking(true)
    try {
      if (isWatchedByUser) {
        // Undo: delete the user's bare review for this content
        await supabase
          .from('reviews')
          .delete()
          .eq('user_id', user.id)
          .eq('content_item_id', review.content_item_id)
          .is('rating', null)
          .is('short_take', null)

        onMarkedWatched?.(review.content_item_id, false)
      } else {
        const { data: membership } = await supabase
          .from('group_memberships')
          .select('group_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!membership) throw new Error('Not in a group')

        await supabase
          .from('reviews')
          .upsert({
            user_id: user.id,
            content_item_id: review.content_item_id,
            group_id: membership.group_id,
            rating: null,
            short_take: null,
            watched_date: new Date().toISOString().split('T')[0],
          }, { onConflict: 'user_id,content_item_id,group_id' })

        onMarkedWatched?.(review.content_item_id, true)
      }
    } catch (err) {
      console.error('Mark watched failed:', err)
    } finally {
      setMarking(false)
    }
  }

  function handleClick() {
    if (isOwn && onEdit) onEdit(review)
  }

  return (
    <div
      id={`review-${review.id}`}
      className={`feed-item feed-item--${mediaTypeClass} ${isOwn ? 'feed-item--editable' : ''} ${bare ? 'feed-item--bare' : ''}`}
      onClick={handleClick}
      title={isOwn ? 'Click to edit your review' : undefined}
    >
      <div className="feed-item-user">
        <Link
          to={`/profile/${review.user_id}`}
          className="feed-item-avatar-link"
          onClick={e => e.stopPropagation()}
        >
          {review.users?.avatar_url && review.users.avatar_url.startsWith('http') ? (
            <img src={review.users.avatar_url} alt="" className="feed-item-avatar" />
          ) : (
            <div className={`feed-item-avatar feed-item-avatar--placeholder ${review.users?.avatar_url ? 'feed-item-avatar--emoji' : ''}`}>
              {review.users?.avatar_url || (review.users?.display_name || '?')[0].toUpperCase()}
            </div>
          )}
        </Link>
        <Link
          to={`/profile/${review.user_id}`}
          className="feed-item-username feed-item-username--link"
          onClick={e => e.stopPropagation()}
        >
          {review.users?.display_name || 'Unknown'}
        </Link>
        <span className="feed-item-action">watched</span>
        <time className="feed-item-date">
          {new Date(review.created_at).toLocaleDateString()}
        </time>
      </div>

      <div className="feed-item-content">
        <img
          src={imgSrc || '/placeholder-poster.svg'}
          alt={content?.title}
          className={isYouTube ? 'feed-item-thumbnail' : 'feed-item-poster'}
        />
        <div className="feed-item-details">
          <h3 className="feed-item-title">{content?.title}</h3>
          <span className="feed-item-meta">
            {contentTypeLabel}
            {content?.year ? ` · ${content.year}` : ''}
            {isYouTube && content?.metadata_json?.channelName
              ? ` · ${content.metadata_json.channelName}`
              : ''}
          </span>

          {displayRating && (
            <StarRating value={displayRating} readonly />
          )}
          {!displayRating && review.rating === null && (
            <span className={`feed-item-watched-badge ${bare ? 'feed-item-watched-badge--bare' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {bare ? 'Watched' : 'Watched'}
            </span>
          )}
          {groupAvg && (
            <div className="feed-item-group-avg">
              <span className="feed-item-group-avg-star">{'\u2605'}</span>
              <span className="feed-item-group-avg-value">{groupAvg.avg.toFixed(1)}</span>
              <span className="feed-item-group-avg-count">group avg ({groupAvg.count})</span>
            </div>
          )}
          {review.short_take && (
            <p className="feed-item-take">{review.short_take}</p>
          )}

          {!bare && genres.length > 0 && (
            <div className="feed-item-genres">
              {genres.map(g => (
                <span key={g} className="genre-chip">{g}</span>
              ))}
            </div>
          )}

          {review.tags?.length > 0 && (
            <div className={`feed-item-tags feed-item-tags--${mediaTypeClass}`}>
              {review.tags.map(t => (
                <span key={t.id} className="tag-chip tag-chip--small">{t.tag}</span>
              ))}
            </div>
          )}

          {!bare && streaming.length > 0 && (
            <div className="streaming-badges">
              {streaming.map(s => (
                <img
                  key={s.id || s.platform_name}
                  src={providerLogoUrl(s.platform_logo_url)}
                  alt={s.platform_name}
                  title={s.platform_name}
                  className="streaming-badge"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!isOwn && (
        <button
          className={`feed-item-mark-watched ${isWatchedByUser ? 'feed-item-mark-watched--done' : ''}`}
          onClick={handleMarkWatched}
          disabled={marking}
        >
          {marking ? (
            <span className="feed-item-mark-watched-spinner">...</span>
          ) : isWatchedByUser ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              Watched
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Mark Watched
            </>
          )}
        </button>
      )}
    </div>
  )
}
