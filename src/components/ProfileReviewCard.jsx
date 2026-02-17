import { posterUrl } from '../lib/tmdb'
import StarRating from './StarRating'

function isBareWatched(review) {
  return review.rating === null
    && !review.short_take
    && (!review.tags || review.tags.length === 0)
}

export default function ProfileReviewCard({ review, onClick }) {
  const content = review.content_items
  const isYouTube = content?.content_type === 'youtube_video'
  const mediaTypeClass = isYouTube ? 'youtube' : content?.content_type === 'movie' ? 'movie' : 'tv'
  const displayRating = review.rating ? review.rating / 2 : null
  const bare = isBareWatched(review)

  const contentTypeLabel = isYouTube
    ? 'YouTube'
    : content?.content_type === 'movie' ? 'Movie' : 'TV Show'

  const imgSrc = isYouTube
    ? content?.poster_thumbnail_url
    : posterUrl(content?.poster_thumbnail_url, 'w92')

  return (
    <div
      className={`profile-review-card profile-review-card--${mediaTypeClass} ${bare ? 'profile-review-card--bare' : ''}`}
      onClick={onClick}
    >
      <img
        src={imgSrc || '/placeholder-poster.svg'}
        alt={content?.title}
        className={isYouTube ? 'profile-review-thumbnail' : 'profile-review-poster'}
      />
      <div className="profile-review-details">
        <h4 className="profile-review-title">{content?.title}</h4>
        <span className="profile-review-meta">
          {contentTypeLabel}
          {content?.year ? ` \u00B7 ${content.year}` : ''}
          {isYouTube && content?.metadata_json?.channelName
            ? ` \u00B7 ${content.metadata_json.channelName}`
            : ''}
        </span>

        {displayRating ? (
          <StarRating value={displayRating} readonly />
        ) : (
          <span className={`feed-item-watched-badge ${bare ? 'feed-item-watched-badge--bare' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Watched
          </span>
        )}

        {review.short_take && (
          <p className="profile-review-take">
            {review.short_take.length > 100
              ? review.short_take.slice(0, 100) + '\u2026'
              : review.short_take}
          </p>
        )}

        {review.tags?.length > 0 && (
          <div className={`feed-item-tags feed-item-tags--${mediaTypeClass}`}>
            {review.tags.map(t => (
              <span key={t.id} className="tag-chip tag-chip--small">{t.tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="profile-review-date">
        {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </div>
    </div>
  )
}
