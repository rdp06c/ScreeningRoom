import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getMovieDetails, getTvDetails, posterUrl } from '../lib/tmdb'
import StarRating from './StarRating'

const VIBE_TAGS = [
  'Feel-Good', 'Mind-Bending', 'Slow Burn', 'Binge-Worthy',
  'Watch With Kids', 'Date Night', 'Background Noise', 'Visually Stunning',
  'Hidden Gem', 'Overhyped', 'Emotional', 'Educational',
  'Sports', 'True Crime', 'Comfort Rewatch',
]

export default function ReviewModal({ item, onClose, onSaved }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(null)
  const [shortTake, setShortTake] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Fetch full details for metadata and streaming providers
      const contentType = item.mediaType === 'movie' ? 'movie' : 'tv_show'
      let details
      if (item.mediaType === 'movie') {
        details = await getMovieDetails(item.id)
      } else {
        details = await getTvDetails(item.id)
      }

      // Upsert content item (dedup by external_id + content_type)
      const { data: contentItem, error: contentError } = await supabase
        .from('content_items')
        .upsert({
          content_type: contentType,
          external_id: String(item.id),
          title: item.title,
          poster_thumbnail_url: item.posterPath,
          year: item.year,
          metadata_json: details.metadata,
        }, { onConflict: 'external_id,content_type' })
        .select()
        .single()

      if (contentError) throw contentError

      // Get user's group (MVP: first group)
      const { data: membership } = await supabase
        .from('group_memberships')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) throw new Error('You are not a member of any group.')

      // Upsert review
      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .upsert({
          user_id: user.id,
          content_item_id: contentItem.id,
          group_id: membership.group_id,
          rating: rating ? Math.round(rating * 2) : null, // Convert 0.5-5.0 to 1-10
          short_take: shortTake.trim() || null,
          watched_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id,content_item_id,group_id' })
        .select()
        .single()

      if (reviewError) throw reviewError

      // Save tags: delete existing, insert new
      await supabase.from('tags').delete().eq('review_id', review.id)
      if (selectedTags.length > 0) {
        const { error: tagError } = await supabase
          .from('tags')
          .insert(selectedTags.map(tag => ({ review_id: review.id, tag })))
        if (tagError) throw tagError
      }

      // Cache streaming availability
      if (details.providers?.length > 0) {
        await supabase
          .from('streaming_availability')
          .delete()
          .eq('content_item_id', contentItem.id)
        await supabase
          .from('streaming_availability')
          .insert(details.providers.map(p => ({
            content_item_id: contentItem.id,
            platform_name: p.name,
            platform_logo_url: p.logoPath,
            country: 'US',
          })))
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          {item.posterPath && (
            <img
              src={posterUrl(item.posterPath, 'w154')}
              alt={item.title}
              className="modal-poster"
            />
          )}
          <div>
            <h2>{item.title}</h2>
            <p className="modal-meta">
              {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
              {item.year ? ` · ${item.year}` : ''}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating (optional)</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="form-group">
            <label>Short Take (optional, {280 - shortTake.length} chars left)</label>
            <textarea
              value={shortTake}
              onChange={e => setShortTake(e.target.value)}
              maxLength={280}
              placeholder="What did you think?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Vibe Tags (optional)</label>
            <div className="tag-grid">
              {VIBE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${selectedTags.includes(tag) ? 'tag-chip--selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Mark as Watched'}
          </button>
        </form>
      </div>
    </div>
  )
}
