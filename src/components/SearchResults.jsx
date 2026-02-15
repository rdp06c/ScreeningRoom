import { posterUrl } from '../lib/tmdb'

export default function SearchResults({ results, onSelect }) {
  return (
    <div className="search-results">
      {results.map(item => (
        <button
          key={`${item.mediaType}-${item.id}`}
          className="search-result-item"
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
      ))}
    </div>
  )
}
