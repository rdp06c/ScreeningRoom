import { useState, useRef, useCallback } from 'react'

export default function StarRating({ value, onChange, readonly = false }) {
  const [hoverValue, setHoverValue] = useState(0)
  const containerRef = useRef(null)
  const touchActiveRef = useRef(false)
  const displayValue = hoverValue || value || 0

  const getValueFromPosition = useCallback((clientX) => {
    if (!containerRef.current) return null
    const stars = containerRef.current.querySelectorAll('.star')
    for (let i = 0; i < stars.length; i++) {
      const rect = stars[i].getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        const isHalf = (clientX - rect.left) < rect.width / 2
        return isHalf ? (i + 1) - 0.5 : (i + 1)
      }
    }
    // If finger is past the last star, return 5
    const lastRect = stars[stars.length - 1]?.getBoundingClientRect()
    if (lastRect && clientX > lastRect.right) return 5
    // If finger is before the first star, return 0.5
    const firstRect = stars[0]?.getBoundingClientRect()
    if (firstRect && clientX < firstRect.left) return 0.5
    return null
  }, [])

  function handleClick(e, starIndex) {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isHalf = (e.clientX - rect.left) < rect.width / 2
    const newValue = isHalf ? starIndex - 0.5 : starIndex
    onChange(newValue === value ? null : newValue)
  }

  function handleMouseMove(e, starIndex) {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isHalf = (e.clientX - rect.left) < rect.width / 2
    setHoverValue(isHalf ? starIndex - 0.5 : starIndex)
  }

  function handleTouchStart(e) {
    if (readonly) return
    const val = getValueFromPosition(e.touches[0].clientX)
    if (val !== null) {
      e.preventDefault()
      touchActiveRef.current = true
      setHoverValue(val)
    }
  }

  function handleTouchMove(e) {
    if (readonly || !touchActiveRef.current) return
    e.preventDefault()
    const val = getValueFromPosition(e.touches[0].clientX)
    if (val !== null) setHoverValue(val)
  }

  function handleTouchEnd() {
    if (readonly || !touchActiveRef.current) return
    touchActiveRef.current = false
    if (hoverValue) {
      onChange(hoverValue)
    }
    setHoverValue(0)
  }

  return (
    <div className={`star-rating-wrap ${readonly ? '' : 'star-rating-wrap--interactive'}`}>
      <div
        ref={containerRef}
        className={`star-rating ${readonly ? 'star-rating--readonly' : ''}`}
        onMouseLeave={() => setHoverValue(0)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {[1, 2, 3, 4, 5].map(star => {
          const filled = displayValue >= star
          const halfFilled = !filled && displayValue >= star - 0.5

          return (
            <span
              key={star}
              className={`star ${filled ? 'star--filled' : ''} ${halfFilled ? 'star--half' : ''}`}
              onClick={(e) => handleClick(e, star)}
              onMouseMove={(e) => handleMouseMove(e, star)}
              role={readonly ? 'presentation' : 'button'}
              tabIndex={readonly ? -1 : 0}
            >
              <svg viewBox="0 0 24 24" className="star-svg">
                <defs>
                  <linearGradient id={`half-${star}`}>
                    <stop offset="50%" stopColor="var(--color-star-active)" />
                    <stop offset="50%" stopColor="var(--color-star-empty)" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={
                    filled
                      ? 'var(--color-star-active)'
                      : halfFilled
                      ? `url(#half-${star})`
                      : 'var(--color-star-empty)'
                  }
                />
              </svg>
            </span>
          )
        })}

        {!readonly && (
          <span className="star-rating-feedback">
            {hoverValue > 0 && (
              <span className="star-rating-preview">{hoverValue.toFixed(1)}</span>
            )}
            {!hoverValue && value !== null && value !== undefined && (
              <span className="star-rating-value">{value.toFixed(1)}</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
