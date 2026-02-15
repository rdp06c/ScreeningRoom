import { useState, useEffect, useRef } from 'react'
import { searchMulti } from '../lib/tmdb'
import SearchResults from './SearchResults'

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
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

  function handleSelect(item) {
    setOpen(false)
    setQuery('')
    onSelect(item)
  }

  return (
    <div className="search-bar" ref={containerRef}>
      <input
        type="text"
        placeholder="Search movies & TV shows..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="search-input"
      />
      {loading && <span className="search-spinner">Searching...</span>}
      {open && results.length > 0 && (
        <SearchResults results={results} onSelect={handleSelect} />
      )}
    </div>
  )
}
