import { useState, useRef, useCallback } from 'react'

const THRESHOLD = 60

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(null)
  const containerRef = useRef(null)

  const isAtTop = useCallback(() => {
    // Check if the page is scrolled to top
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    return scrollTop <= 0
  }, [])

  function handleTouchStart(e) {
    if (refreshing) return
    if (isAtTop()) {
      touchStartY.current = e.touches[0].clientY
    } else {
      touchStartY.current = null
    }
  }

  function handleTouchMove(e) {
    if (touchStartY.current === null || refreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartY.current
    if (diff > 0) {
      // Dampen the pull distance for a natural feel
      setPullDistance(Math.min(diff * 0.5, 100))
    } else {
      setPullDistance(0)
    }
  }

  async function handleTouchEnd() {
    if (touchStartY.current === null || refreshing) return
    touchStartY.current = null

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }

  const showIndicator = pullDistance > 0 || refreshing

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      {showIndicator && (
        <div className="pull-indicator" style={{ height: pullDistance }}>
          <div className={`pull-indicator-spinner ${refreshing ? 'pull-indicator-spinner--active' : ''}`}>
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              style={{
                transform: refreshing ? undefined : `rotate(${(pullDistance / THRESHOLD) * 360}deg)`,
                opacity: Math.min(pullDistance / THRESHOLD, 1),
                transition: refreshing ? undefined : 'none',
              }}
            >
              <path
                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
                fill="var(--color-primary)"
              />
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
