const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
]

export function extractVideoId(url) {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function isYouTubeUrl(text) {
  return /(?:youtube\.com|youtu\.be)\//.test(text)
}

export async function getVideoDetails(videoId) {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY
  if (!key) throw new Error('Missing VITE_YOUTUBE_API_KEY in .env')

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)

  const data = await res.json()
  if (!data.items || data.items.length === 0) {
    throw new Error('YouTube video not found')
  }

  const item = data.items[0]
  const snippet = item.snippet
  const duration = parseDuration(item.contentDetails.duration)

  return {
    id: videoId,
    mediaType: 'youtube',
    title: snippet.title,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
    channelName: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    description: snippet.description,
    duration,
    year: snippet.publishedAt ? new Date(snippet.publishedAt).getFullYear() : null,
  }
}

function parseDuration(iso8601) {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
