import { useState } from 'react'

export default function StarRating({ value, onChange, readonly = false }) {
  const [hoverValue, setHoverValue] = useState(0)
  const displayValue = hoverValue || value || 0

  function handleClick(starIndex, isHalf) {
    if (readonly) return
    const newValue = isHalf ? starIndex - 0.5 : starIndex
    // Toggle off if clicking the same value
    onChange(newValue === value ? null : newValue)
  }

  function handleMouseMove(e, starIndex) {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isHalf = (e.clientX - rect.left) < rect.width / 2
    setHoverValue(isHalf ? starIndex - 0.5 : starIndex)
  }

  return (
    <div
      className={`star-rating ${readonly ? 'star-rating--readonly' : ''}`}
      onMouseLeave={() => setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const filled = displayValue >= star
        const halfFilled = !filled && displayValue >= star - 0.5

        return (
          <span
            key={star}
            className={`star ${filled ? 'star--filled' : ''} ${halfFilled ? 'star--half' : ''}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const isHalf = (e.clientX - rect.left) < rect.width / 2
              handleClick(star, isHalf)
            }}
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
      {value !== null && value !== undefined && (
        <span className="star-rating-label">{value.toFixed(1)}</span>
      )}
    </div>
  )
}
