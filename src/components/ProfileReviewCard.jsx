import { posterUrl } from '../lib/tmdb'
import StarRating from './StarRating'

export default function ProfileReviewCard({ review, onClick }) {
  const content = review.content_items
  const isYouTube = content?.content_type === 'youtube_video'
  const mediaTypeClass = isYouTube ? 'youtube' : content?.content_type === 'movie' ? 'movie' : 'tv'
  const displayRating = review.rating ? review.rating / 2 : null

  const contentTypeLabel = isYouTube
    ? 'YouTube'
    : content?.content_type === 'movie' ? 'Movie' : 'TV Show'

  const imgSrc = isYouTube
    ? content?.poster_thumbnail_url
    : posterUrl(content?.poster_thumbnail_url, 'w92')

  return (
    <div
      className={`profile-review-card profile-review-card--${mediaTypeClass}`}
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
          <span className="feed-item-watched-badge">Watched</span>
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
