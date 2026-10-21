/** Minimal typings for the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference). */
export interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  getPlayerState(): number
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YTNamespace> | null = null

/** Load the IFrame API script once. Rejects after `timeoutMs` (offline, blocked by an extension...). */
export function loadYouTubeApi(timeoutMs = 12000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const timer = setTimeout(() => {
      loading = null
      reject(new Error('timeout'))
    }, timeoutMs)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      clearTimeout(timer)
      resolve(window.YT as YTNamespace)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      clearTimeout(timer)
      loading = null
      s.remove()
      reject(new Error('script-error'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** YouTube player error codes -> Vietnamese explanation. */
export function describePlayerError(code: number): string {
  switch (code) {
    case 2:
      return 'Tham số video không hợp lệ.'
    case 5:
      return 'Trình duyệt không phát được video HTML5 này.'
    case 100:
      return 'Video không tồn tại hoặc đã bị gỡ/đặt riêng tư.'
    case 101:
    case 150:
      return 'Chủ sở hữu không cho phép nhúng video này vào trang khác.'
    default:
      return `Lỗi trình phát YouTube (mã ${code}).`
  }
}

export const youtubeUrlAt = (videoId: string, seconds: number) =>
  `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`
