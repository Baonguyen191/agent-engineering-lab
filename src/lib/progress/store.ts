import { useRef, useSyncExternalStore } from 'react'
import { dayKey } from '../format'
import { review } from './leitner'
import {
  STORAGE_KEY,
  emptyLessonProgress,
  emptyProgress,
  progressSchema,
  type LabProgress,
  type LessonProgress,
  type Progress,
} from './schema'

/**
 * Progress store: a single immutable state object persisted to localStorage.
 * Components read it with `useProgress(selector)`; all writes go through the actions below.
 */

type Listener = () => void

let state: Progress = load()
let loadError: string | null = null
const listeners = new Set<Listener>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let clock: () => Date = () => new Date()

function load(): Progress {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = progressSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
    loadError =
      'Dữ liệu tiến độ đã lưu không hợp lệ nên được bỏ qua. Bản gốc vẫn còn trong localStorage (khóa ael:progress:v1:corrupt).'
    globalThis.localStorage?.setItem(`${STORAGE_KEY}:corrupt`, raw)
  } catch {
    loadError = 'Không đọc được dữ liệu tiến độ từ trình duyệt (localStorage bị chặn hoặc hỏng).'
  }
  return emptyProgress()
}

function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 250)
}

/** Write pending changes immediately (also called on page hide). */
export function flush() {
  clearTimeout(saveTimer)
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    loadError = 'Không lưu được tiến độ: bộ nhớ trình duyệt đầy hoặc bị chặn.'
    emit()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
}

function emit() {
  for (const l of listeners) l()
}

function update(recipe: (draft: Progress) => Progress, countsAsActivity = true) {
  let next = recipe(state)
  if (countsAsActivity) {
    const key = dayKey(clock())
    next = { ...next, activity: { ...next.activity, [key]: (next.activity[key] ?? 0) + 1 } }
  }
  state = next
  persist()
  emit()
}

function subscribe(l: Listener) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const getProgress = (): Progress => state
export const getLoadError = (): string | null => loadError

/**
 * Subscribe to a slice of progress. The result is cached per (state, selector) pair, so selectors
 * may derive new objects without causing render loops.
 */
export function useProgress<T>(selector: (p: Progress) => T): T {
  const cache = useRef<{ s: Progress; f: (p: Progress) => T; v: T } | null>(null)
  const get = () => {
    const c = cache.current
    if (c && c.s === state && c.f === selector) return c.v
    const v = selector(state)
    cache.current = { s: state, f: selector, v }
    return v
  }
  return useSyncExternalStore(subscribe, get, get)
}

/** For tests: replace the clock and/or state. */
export function __setTestState(next: Progress, now?: () => Date) {
  state = next
  if (now) clock = now
  emit()
}

const nowIso = () => clock().toISOString()

function withLesson(p: Progress, id: string, fn: (l: LessonProgress) => LessonProgress): Progress {
  return { ...p, lessons: { ...p.lessons, [id]: fn(p.lessons[id] ?? emptyLessonProgress()) } }
}

// ------------------------------------------------------------------ lessons

export function openLesson(id: string) {
  update(
    (p) => ({
      ...withLesson(p, id, (l) =>
        l.status === 'not_started' ? { ...l, status: 'in_progress', startedAt: nowIso() } : l,
      ),
      lastLessonId: id,
    }),
    false,
  )
}

export function setLessonCompleted(id: string, completed: boolean) {
  update((p) =>
    withLesson(p, id, (l) =>
      completed
        ? { ...l, status: 'completed', completedAt: nowIso(), startedAt: l.startedAt ?? nowIso() }
        : { ...l, status: 'in_progress', completedAt: undefined },
    ),
  )
}

/** Called periodically by the video player. `delta` = seconds actually played since the last call. */
export function recordVideoProgress(id: string, position: number, delta: number) {
  update(
    (p) =>
      withLesson(p, id, (l) => ({
        ...l,
        lastPosition: Math.round(position),
        watchedSeconds: l.watchedSeconds + Math.max(0, Math.min(delta, 30)),
      })),
    false,
  )
}

export function setNotes(id: string, notes: string) {
  update((p) => withLesson(p, id, (l) => ({ ...l, notes })), false)
}

export function toggleChecklist(id: string, index: number) {
  update((p) =>
    withLesson(p, id, (l) => ({ ...l, checklist: { ...l.checklist, [index]: !l.checklist[index] } })),
  )
}

export function addBookmark(id: string, t: number, label: string) {
  update(
    (p) =>
      withLesson(p, id, (l) => ({
        ...l,
        bookmarks: [...l.bookmarks, { t: Math.round(t), label }].sort((a, b) => a.t - b.t),
      })),
    false,
  )
}

export function removeBookmark(id: string, index: number) {
  update(
    (p) => withLesson(p, id, (l) => ({ ...l, bookmarks: l.bookmarks.filter((_, i) => i !== index) })),
    false,
  )
}

// ------------------------------------------------------------------ quiz & review

const MAX_ATTEMPTS = 5000

/**
 * Record a quiz answer. A wrong answer puts the question into the review queue (box 1);
 * a correct answer to a question already in the queue counts as a successful review.
 */
export function recordQuizAnswer(questionId: string, lessonId: string, correct: boolean) {
  update((p) => {
    const attempts = [...p.quizAttempts, { questionId, lessonId, correct, at: nowIso() }].slice(-MAX_ATTEMPTS)
    const key = `q:${questionId}`
    const existing = p.cards[key]
    const cards = !correct || existing ? { ...p.cards, [key]: review(existing, correct, clock()) } : p.cards
    return { ...p, quizAttempts: attempts, cards }
  })
}

/** Review a flashcard ("f:<id>") or a queued question ("q:<id>"). */
export function reviewItem(itemId: string, correct: boolean) {
  update((p) => ({ ...p, cards: { ...p.cards, [itemId]: review(p.cards[itemId], correct, clock()) } }))
}

// ------------------------------------------------------------------ lab & project

const emptyLab = (code: string): LabProgress => ({
  code,
  passed: false,
  bestPassed: 0,
  total: 0,
  attempts: 0,
  hintsShown: 0,
  solutionViewed: false,
})

export function saveLabCode(exerciseId: string, code: string) {
  update(
    (p) => ({ ...p, lab: { ...p.lab, [exerciseId]: { ...(p.lab[exerciseId] ?? emptyLab(code)), code } } }),
    false,
  )
}

export function recordLabRun(exerciseId: string, code: string, passedCount: number, total: number) {
  update((p) => {
    const prev = p.lab[exerciseId] ?? emptyLab(code)
    return {
      ...p,
      lab: {
        ...p.lab,
        [exerciseId]: {
          ...prev,
          code,
          attempts: prev.attempts + 1,
          lastRunAt: nowIso(),
          total,
          bestPassed: Math.max(prev.bestPassed, passedCount),
          passed: prev.passed || (total > 0 && passedCount === total),
        },
      },
    }
  })
}

export function revealHint(exerciseId: string, code: string, count: number) {
  update((p) => {
    const prev = p.lab[exerciseId] ?? emptyLab(code)
    return {
      ...p,
      lab: { ...p.lab, [exerciseId]: { ...prev, hintsShown: Math.max(prev.hintsShown, count) } },
    }
  }, false)
}

export function markSolutionViewed(exerciseId: string, code: string) {
  update(
    (p) => ({
      ...p,
      lab: { ...p.lab, [exerciseId]: { ...(p.lab[exerciseId] ?? emptyLab(code)), solutionViewed: true } },
    }),
    false,
  )
}

export function toggleStageChecklist(stageId: string, index: number) {
  update((p) => {
    const prev = p.stages[stageId] ?? { checklist: {} }
    return {
      ...p,
      stages: {
        ...p.stages,
        [stageId]: { checklist: { ...prev.checklist, [index]: !prev.checklist[index] } },
      },
    }
  })
}

// ------------------------------------------------------------------ data management

export function exportProgress(): string {
  return JSON.stringify({ app: 'agent-engineering-lab', exportedAt: nowIso(), progress: state }, null, 2)
}

/** Replace all progress with an exported file. Returns an error message, or null on success. */
export function importProgress(json: string): string | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return 'File không phải JSON hợp lệ.'
  }
  const candidate = (data as { progress?: unknown })?.progress ?? data
  const parsed = progressSchema.safeParse(candidate)
  if (!parsed.success)
    return `Dữ liệu không đúng định dạng: ${parsed.error.issues[0]?.path.join('.') || 'gốc'} — ${parsed.error.issues[0]?.message}`
  state = parsed.data
  loadError = null
  flush()
  emit()
  return null
}

export function resetProgress() {
  state = emptyProgress()
  loadError = null
  flush()
  emit()
}
