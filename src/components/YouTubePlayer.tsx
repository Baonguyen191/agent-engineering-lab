import { ExternalLink, RefreshCw, VideoOff } from 'lucide-react'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { describePlayerError, loadYouTubeApi, youtubeUrlAt, type YTPlayer } from '../lib/youtube'
import { Button } from './ui'

export interface PlayerHandle {
  seekTo(seconds: number, play?: boolean): void
  getCurrentTime(): number | null
}

type Phase = 'loading' | 'ready' | 'api-error' | 'player-error'

/**
 * YouTube IFrame Player. `start` is applied when the player is created and whenever it changes
 * (new lesson). While playing, reports progress every 5 s via onProgress(position, playedDelta).
 */
export function YouTubePlayer({
  videoId,
  start,
  onProgress,
  ref,
}: {
  videoId: string
  start: number
  onProgress?: (position: number, delta: number) => void
  ref?: Ref<PlayerHandle>
}) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const progressRef = useRef(onProgress)
  progressRef.current = onProgress
  const startRef = useRef(start)
  // Player methods exist only after onReady; a seek requested earlier is applied then.
  const readyRef = useRef(false)
  const pendingSeek = useRef<{ seconds: number; play: boolean } | null>(null)

  useImperativeHandle(ref, () => ({
    seekTo(seconds, play = true) {
      const p = player.current
      if (!p || !readyRef.current) {
        pendingSeek.current = { seconds, play }
        return
      }
      p.seekTo(seconds, true)
      if (play) p.playVideo()
    },
    getCurrentTime() {
      if (!readyRef.current) return null
      try {
        return player.current?.getCurrentTime() ?? null
      } catch {
        return null
      }
    },
  }))

  // Create the player once (or again after "retry").
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    setPhase('loading')
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return
        const mount = document.createElement('div')
        host.current.replaceChildren(mount)
        let last: number | null = null
        const createdAt = startRef.current
        player.current = new YT.Player(mount, {
          videoId,
          playerVars: {
            start: Math.floor(createdAt),
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              readyRef.current = true
              const p = player.current
              const pending = pendingSeek.current
              pendingSeek.current = null
              if (pending) {
                p?.seekTo(pending.seconds, true)
                if (pending.play) p?.playVideo()
              } else if (startRef.current !== createdAt) {
                // The lesson changed while the player was loading.
                p?.seekTo(startRef.current, true)
              }
              setPhase('ready')
            },
            onError: (e) => {
              setError(describePlayerError(e.data))
              setPhase('player-error')
            },
            onStateChange: (e) => {
              clearInterval(timer)
              const tick = () => {
                const t = player.current?.getCurrentTime()
                if (t === undefined) return
                const delta = last === null ? 0 : t - last
                last = t
                // Ignore jumps caused by seeking.
                progressRef.current?.(t, delta > 0 && delta < 7 ? delta : 0)
              }
              if (e.data === YT.PlayerState.PLAYING) {
                last = player.current?.getCurrentTime() ?? null
                timer = setInterval(tick, 5000)
              } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                tick()
                last = null
              }
            },
          },
        })
      })
      .catch(() => !cancelled && setPhase('api-error'))
    return () => {
      cancelled = true
      clearInterval(timer)
      try {
        player.current?.destroy()
      } catch {
        /* player already gone */
      }
      player.current = null
      readyRef.current = false
    }
  }, [videoId, attempt])

  // New lesson -> jump to its start without autoplay.
  useEffect(() => {
    if (startRef.current === start) return
    startRef.current = start
    const p = player.current
    if (phase === 'ready' && p) {
      p.seekTo(start, true)
      p.pauseVideo()
    }
  }, [start, phase])

  const youtubeLink = youtubeUrlAt(videoId, start)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
      <div ref={host} className="absolute inset-0 [&>iframe]:size-full" />
      {phase === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-[#9aa3b5]">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 animate-spin" /> Đang tải trình phát YouTube…
          </div>
        </div>
      )}
      {(phase === 'api-error' || phase === 'player-error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0f14] p-6 text-center">
          <VideoOff className="size-8 text-[#6b7487]" />
          <p className="max-w-sm text-sm text-[#d7dbe5]">
            {phase === 'api-error'
              ? 'Không tải được trình phát YouTube (mất mạng hoặc bị tiện ích chặn quảng cáo/tracking chặn).'
              : error}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {phase === 'api-error' && (
              <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw className="size-3.5" /> Thử lại
              </Button>
            )}
            <a
              href={youtubeLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-strong px-3 text-[13px] font-medium text-white"
            >
              Mở trên YouTube <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
