const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

function getApiKey() {
  const key = import.meta.env.VITE_TMDB_API_KEY
  if (!key) throw new Error('Missing VITE_TMDB_API_KEY in .env')
  return key
}

async function tmdbFetch(path, params = {}) {
  const key = getApiKey()
  const url = new URL(`${TMDB_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  // Support both API key (short) and Bearer token (starts with eyJ)
  const headers = {}
  if (key.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${key}`
  } else {
    url.searchParams.set('api_key', key)
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`)
  return res.json()
}

export async function searchMulti(query) {
  if (!query.trim()) return []
  const data = await tmdbFetch('/search/multi', { query, include_adult: 'false' })
  return data.results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .map(r => ({
      id: r.id,
      mediaType: r.media_type,
      title: r.media_type === 'movie' ? r.title : r.name,
      year: getYear(r),
      posterPath: r.poster_path,
      overview: r.overview,
      genreIds: r.genre_ids || [],
    }))
}

export async function getMovieDetails(id) {
  const data = await tmdbFetch(`/movie/${id}`, { append_to_response: 'watch/providers' })
  return {
    id: data.id,
    mediaType: 'movie',
    title: data.title,
    year: data.release_date ? parseInt(data.release_date) : null,
    posterPath: data.poster_path,
    overview: data.overview,
    genres: data.genres || [],
    runtime: data.runtime,
    providers: extractProviders(data['watch/providers']),
    metadata: {
      genres: (data.genres || []).map(g => g.name),
      runtime: data.runtime,
      tagline: data.tagline,
    },
  }
}

export async function getTvDetails(id) {
  const data = await tmdbFetch(`/tv/${id}`, { append_to_response: 'watch/providers' })
  return {
    id: data.id,
    mediaType: 'tv',
    title: data.name,
    year: data.first_air_date ? parseInt(data.first_air_date) : null,
    posterPath: data.poster_path,
    overview: data.overview,
    genres: data.genres || [],
    seasons: data.number_of_seasons,
    providers: extractProviders(data['watch/providers']),
    metadata: {
      genres: (data.genres || []).map(g => g.name),
      seasons: data.number_of_seasons,
      episodes: data.number_of_episodes,
      status: data.status,
    },
  }
}

function extractProviders(watchProviders) {
  if (!watchProviders?.results?.US) return []
  const us = watchProviders.results.US
  const all = [
    ...(us.flatrate || []),
    ...(us.free || []),
    ...(us.ads || []),
  ]
  // Deduplicate by provider_id
  const seen = new Set()
  return all.filter(p => {
    if (seen.has(p.provider_id)) return false
    seen.add(p.provider_id)
    return true
  }).map(p => ({
    name: p.provider_name,
    logoPath: p.logo_path,
    id: p.provider_id,
  }))
}

function getYear(result) {
  const date = result.media_type === 'movie' ? result.release_date : result.first_air_date
  return date ? parseInt(date) : null
}

export function posterUrl(path, size = 'w342') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function providerLogoUrl(path) {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/original${path}`
}
