import { useState } from 'react'
import SearchBar from '../components/SearchBar'
import ReviewModal from '../components/ReviewModal'

export default function Home() {
  const [selectedItem, setSelectedItem] = useState(null)

  return (
    <div className="home-page">
      <section className="home-hero">
        <h1>What did you watch?</h1>
        <p>Search for a movie or TV show to log it.</p>
        <SearchBar onSelect={setSelectedItem} />
      </section>

      {selectedItem && (
        <ReviewModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
