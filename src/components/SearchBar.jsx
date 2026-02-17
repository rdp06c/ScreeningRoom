import { useState, useEffect, useRef } from 'react'
import { searchMulti } from '../lib/tmdb'
import { isYouTubeUrl, extractVideoId, getVideoDetails } from '../lib/youtube'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SearchResults from './SearchResults'

export default function SearchBar({ onSelect, onQuickWatched }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [watchedMap, setWatchedMap] = useState({})
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Fetch user's existing reviews to build watched map
  useEffect(() => {
    if (!user) return
    async function fetchWatched() {
      const { data } = await supabase
        .from('reviews')
        .select('content_items ( content_type, external_id )')
        .eq('user_id', user.id)

      if (data) {
        const map = {}
        data.forEach(r => {
          if (r.content_items) {
            const type = r.content_items.content_type === 'movie' ? 'movie'
              : r.content_items.content_type === 'tv_show' ? 'tv'
              : 'youtube'
            map[`${type}-${r.content_items.external_id}`] = true
          }
        })
        setWatchedMap(map)
      }
    }
    fetchWatched()
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    // If it's a YouTube URL, don't debounce search — handle on submit/enter
    if (isYouTubeUrl(query.trim())) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchMulti(query)
        setResults(data)
        setOpen(true)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleYouTubeSubmit() {
    const videoId = extractVideoId(query.trim())
    if (!videoId) return

    setLoading(true)
    try {
      const details = await getVideoDetails(videoId)
      setQuery('')
      onSelect({
        id: videoId,
        mediaType: 'youtube',
        title: details.title,
        posterPath: null,
        thumbnailUrl: details.thumbnailUrl,
        year: details.year,
        channelName: details.channelName,
        duration: details.duration,
        description: details.description,
        publishedAt: details.publishedAt,
      })
    } catch (err) {
      console.error('YouTube fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && isYouTubeUrl(query.trim())) {
      e.preventDefault()
      handleYouTubeSubmit()
    }
  }

  function handleSelect(item) {
    setOpen(false)
    setQuery('')
    onSelect(item)
  }

  function handleMarkedWatched(key) {
    setWatchedMap(prev => ({ ...prev, [key]: true }))
    onQuickWatched?.()
  }

  return (
    <div className="search-bar" ref={containerRef}>
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search Movie/Show or Paste YouTube URL"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="search-input"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {isYouTubeUrl(query.trim()) && (
          <button
            className="search-yt-btn"
            onClick={handleYouTubeSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? 'Loading...' : 'Fetch'}
          </button>
        )}
      </div>
      {loading && !isYouTubeUrl(query.trim()) && <span className="search-spinner">Searching...</span>}
      {open && results.length > 0 && (
        <SearchResults
          results={results}
          onSelect={handleSelect}
          watchedMap={watchedMap}
          onMarkedWatched={handleMarkedWatched}
        />
      )}
    </div>
  )
}
