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
  'Short Film', 'Nature', 'Animated',
]

export default function ReviewModal({ item, onClose, onSaved, existingReview }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(
    existingReview?.rating ? existingReview.rating / 2 : null
  )
  const [shortTake, setShortTake] = useState(existingReview?.short_take || '')
  const [selectedTags, setSelectedTags] = useState(
    existingReview?.tags?.map(t => t.tag) || []
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const isYouTube = item.mediaType === 'youtube'
  const isEditing = !!existingReview

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleDelete() {
    if (!confirm('Delete this review? This cannot be undone.')) return

    setDeleting(true)
    setError(null)

    try {
      await supabase.from('tags').delete().eq('review_id', existingReview.id)
      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', existingReview.id)

      if (deleteError) throw deleteError

      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (isYouTube && selectedTags.length === 0) {
      setError('YouTube videos require at least one vibe tag.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let contentType, metadata, providers = []

      if (isYouTube) {
        contentType = 'youtube_video'
        metadata = {
          channelName: item.channelName,
          duration: item.duration,
          description: item.description?.slice(0, 500),
          publishedAt: item.publishedAt,
        }
      } else {
        contentType = item.mediaType === 'movie' ? 'movie' : 'tv_show'
        const details = item.mediaType === 'movie'
          ? await getMovieDetails(item.id)
          : await getTvDetails(item.id)
        metadata = details.metadata
        providers = details.providers || []
      }

      // Upsert content item (dedup by external_id + content_type)
      const { data: contentItem, error: contentError } = await supabase
        .from('content_items')
        .upsert({
          content_type: contentType,
          external_id: String(item.id),
          title: item.title,
          poster_thumbnail_url: isYouTube ? item.thumbnailUrl : item.posterPath,
          year: item.year,
          metadata_json: metadata,
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
          rating: rating ? Math.round(rating * 2) : null,
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

      // Cache streaming availability (movies/TV only)
      if (!isYouTube && providers.length > 0) {
        await supabase
          .from('streaming_availability')
          .delete()
          .eq('content_item_id', contentItem.id)
        await supabase
          .from('streaming_availability')
          .insert(providers.map(p => ({
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

  const thumbnailSrc = isYouTube
    ? item.thumbnailUrl
    : posterUrl(item.posterPath, 'w154')

  const contentLabel = isYouTube
    ? 'YouTube'
    : item.mediaType === 'movie' ? 'Movie' : 'TV Show'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          {thumbnailSrc && (
            <img
              src={thumbnailSrc}
              alt={item.title}
              className={isYouTube ? 'modal-thumbnail' : 'modal-poster'}
            />
          )}
          <div>
            <h2>{item.title}</h2>
            <p className="modal-meta">
              {contentLabel}
              {item.year ? ` · ${item.year}` : ''}
              {isYouTube && item.duration ? ` · ${item.duration}` : ''}
            </p>
            {isYouTube && item.channelName && (
              <p className="modal-channel">{item.channelName}</p>
            )}
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
            <label>
              Vibe Tags {isYouTube ? '(at least one required)' : '(optional)'}
            </label>
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

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
              {saving ? 'Saving...' : isEditing ? 'Update Review' : 'Mark as Watched'}
            </button>
            {isEditing && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Review'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
