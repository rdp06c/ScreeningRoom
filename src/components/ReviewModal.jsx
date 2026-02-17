import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  const isYouTube = item.mediaType === 'youtube'
  const isEditing = !!existingReview

  // Swipe-to-dismiss
  const modalRef = useRef(null)
  const dragStartY = useRef(null)
  const dragCurrentY = useRef(0)

  const handleTouchStart = useCallback((e) => {
    const modal = modalRef.current
    if (!modal) return
    // Only start drag if modal is scrolled to top
    if (modal.scrollTop > 0) return
    dragStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy < 0) {
      // Swiping up — reset and let normal scroll take over
      dragStartY.current = null
      dragCurrentY.current = 0
      if (modalRef.current) modalRef.current.style.transform = ''
      return
    }
    dragCurrentY.current = dy
    if (modalRef.current) {
      modalRef.current.style.transform = `translateY(${dy}px)`
      modalRef.current.style.transition = 'none'
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return
    const dy = dragCurrentY.current
    dragStartY.current = null
    dragCurrentY.current = 0

    if (dy > 120) {
      // Dismiss
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.2s ease-out'
        modalRef.current.style.transform = 'translateY(100%)'
      }
      setTimeout(() => onClose(), 200)
    } else {
      // Snap back
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.2s ease-out'
        modalRef.current.style.transform = ''
      }
    }
  }, [onClose])

  // Lock background scrolling while modal is open
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.classList.add('no-scroll')
    document.body.style.top = `-${scrollY}px`
    return () => {
      document.body.classList.remove('no-scroll')
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

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
      <div
        className="modal"
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>
              Vibe Tags {isYouTube ? '(at least one required)' : '(optional)'}
            </label>
            <div className={`tag-grid tag-grid--${item.mediaType}`}>
              {VIBE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip ${selectedTags.includes(tag) ? 'tag-chip--selected' : ''}`}
                  onClick={(e) => { toggleTag(tag); e.currentTarget.blur() }}
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
            {isEditing && !confirmDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                Delete Review
              </button>
            )}
            {isEditing && confirmDelete && (
              <div className="confirm-delete-row">
                <span className="confirm-delete-text">Are you sure?</span>
                <button
                  type="button"
                  className="btn btn-danger confirm-delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  className="btn confirm-cancel-btn"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
