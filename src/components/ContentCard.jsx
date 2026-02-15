import { posterUrl } from '../lib/tmdb'
import StarRating from './StarRating'

export default function ContentCard({ item, onClick }) {
  const avgRating = item.avg_rating ? item.avg_rating / 2 : null // Convert 1-10 to 0.5-5.0

  return (
    <div className="content-card" onClick={onClick}>
      <img
        src={posterUrl(item.poster_thumbnail_url, 'w185') || '/placeholder-poster.svg'}
        alt={item.title}
        className="content-card-poster"
      />
      <div className="content-card-info">
        <h3 className="content-card-title">{item.title}</h3>
        <span className="content-card-meta">
          {item.content_type === 'movie' ? 'Movie' : item.content_type === 'tv_show' ? 'TV' : 'YouTube'}
          {item.year ? ` · ${item.year}` : ''}
        </span>
        {avgRating && (
          <div className="content-card-rating">
            <StarRating value={avgRating} readonly />
            <span className="content-card-rating-count">
              ({item.review_count} {item.review_count === 1 ? 'rating' : 'ratings'})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
