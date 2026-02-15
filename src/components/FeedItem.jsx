import { posterUrl } from '../lib/tmdb'
import StarRating from './StarRating'

export default function FeedItem({ review }) {
  const displayRating = review.rating ? review.rating / 2 : null

  return (
    <div className="feed-item">
      <div className="feed-item-user">
        {review.users?.avatar_url ? (
          <img src={review.users.avatar_url} alt="" className="feed-item-avatar" />
        ) : (
          <div className="feed-item-avatar feed-item-avatar--placeholder">
            {(review.users?.display_name || '?')[0].toUpperCase()}
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
          src={posterUrl(review.content_items?.poster_thumbnail_url, 'w92') || '/placeholder-poster.svg'}
          alt={review.content_items?.title}
          className="feed-item-poster"
        />
        <div className="feed-item-details">
          <h3 className="feed-item-title">{review.content_items?.title}</h3>
          <span className="feed-item-meta">
            {review.content_items?.content_type === 'movie' ? 'Movie' : 'TV Show'}
            {review.content_items?.year ? ` · ${review.content_items.year}` : ''}
          </span>
          {displayRating && (
            <StarRating value={displayRating} readonly />
          )}
          {!displayRating && review.rating === null && (
            <span className="feed-item-watched-badge">Watched</span>
          )}
          {review.short_take && (
            <p className="feed-item-take">{review.short_take}</p>
          )}
          {review.tags?.length > 0 && (
            <div className="feed-item-tags">
              {review.tags.map(t => (
                <span key={t.id} className="tag-chip tag-chip--small">{t.tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
