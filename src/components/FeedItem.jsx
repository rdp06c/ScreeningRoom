import { posterUrl, providerLogoUrl } from '../lib/tmdb'
import { useAuth } from '../contexts/AuthContext'
import StarRating from './StarRating'

export default function FeedItem({ review, onEdit, groupAvg }) {
  const { user } = useAuth()
  const displayRating = review.rating ? review.rating / 2 : null
  const content = review.content_items
  const isYouTube = content?.content_type === 'youtube_video'
  const genres = content?.metadata_json?.genres || []
  const streaming = content?.streaming_availability || []
  const isOwn = user?.id === review.user_id

  const contentTypeLabel = isYouTube
    ? 'YouTube'
    : content?.content_type === 'movie' ? 'Movie' : 'TV Show'

  const imgSrc = isYouTube
    ? content?.poster_thumbnail_url
    : posterUrl(content?.poster_thumbnail_url, 'w92')

  function handleClick() {
    if (isOwn && onEdit) onEdit(review)
  }

  return (
    <div
      id={`review-${review.id}`}
      className={`feed-item ${isOwn ? 'feed-item--editable' : ''}`}
      onClick={handleClick}
      title={isOwn ? 'Click to edit your review' : undefined}
    >
      <div className="feed-item-user">
        {review.users?.avatar_url && review.users.avatar_url.startsWith('http') ? (
          <img src={review.users.avatar_url} alt="" className="feed-item-avatar" />
        ) : (
          <div className={`feed-item-avatar feed-item-avatar--placeholder ${review.users?.avatar_url ? 'feed-item-avatar--emoji' : ''}`}>
            {review.users?.avatar_url || (review.users?.display_name || '?')[0].toUpperCase()}
          </div>
        )}
        <span className="feed-item-username">{review.users?.display_name || 'Unknown'}</span>
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
            <span className="feed-item-watched-badge">Watched</span>
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

          {genres.length > 0 && (
            <div className="feed-item-genres">
              {genres.map(g => (
                <span key={g} className="genre-chip">{g}</span>
              ))}
            </div>
          )}

          {review.tags?.length > 0 && (
            <div className="feed-item-tags">
              {review.tags.map(t => (
                <span key={t.id} className="tag-chip tag-chip--small">{t.tag}</span>
              ))}
            </div>
          )}

          {streaming.length > 0 && (
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
    </div>
  )
}
