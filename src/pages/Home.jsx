import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import ReviewModal from '../components/ReviewModal'

export default function Home() {
  const [selectedItem, setSelectedItem] = useState(null)
  const navigate = useNavigate()

  function handleSaved() {
    setSelectedItem(null)
    navigate('/feed')
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <h1>What did you watch?</h1>
        <p>Search for a movie, TV show, or paste a YouTube URL.</p>
        <SearchBar onSelect={setSelectedItem} />
      </section>

      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
