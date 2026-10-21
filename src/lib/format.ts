/** 3725 -> "1:02:05"; 125 -> "2:05". */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** 5400 -> "1 giờ 30 phút"; 300 -> "5 phút". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} giờ ${m} phút`
  if (h) return `${h} giờ`
  return `${m} phút`
}

export const percent = (part: number, total: number): number => (total ? Math.round((part / total) * 100) : 0)

/** Local calendar day key, e.g. "2026-10-21". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })

export function relativeTime(iso: string, now = new Date()): string {
  const diff = (Date.parse(iso) - now.getTime()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

/** Lowercase, strip Vietnamese diacritics; used for search. */
export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}
