import type { Exercise, Flashcard, Lesson, Module, ProjectStage, Question } from '../../content/types'
import { dayKey } from '../format'
import { dueForecast, isDue } from './leitner'
import type { LessonProgress, Progress, QuizAttempt } from './schema'

export interface ContentIndex {
  modules: Module[]
  lessons: Lesson[]
  questions: Question[]
  flashcards: Flashcard[]
  exercises: Exercise[]
  stages: ProjectStage[]
}

export type LessonStatus = LessonProgress['status']

export const lessonStatus = (p: Progress, id: string): LessonStatus => p.lessons[id]?.status ?? 'not_started'

/** Latest attempt per question (later attempts override earlier ones). */
export function latestAttempts(attempts: QuizAttempt[]): Map<string, QuizAttempt> {
  const m = new Map<string, QuizAttempt>()
  for (const a of attempts) m.set(a.questionId, a)
  return m
}

export interface Accuracy {
  answered: number
  correct: number
  /** 0..1, or null when nothing has been answered. */
  rate: number | null
}

function accuracyOf(attempts: Iterable<QuizAttempt>): Accuracy {
  let answered = 0
  let correct = 0
  for (const a of attempts) {
    answered++
    if (a.correct) correct++
  }
  return { answered, correct, rate: answered ? correct / answered : null }
}

/** Accuracy per lesson using each question's latest attempt. */
export function lessonAccuracy(p: Progress): Map<string, Accuracy> {
  const byLesson = new Map<string, QuizAttempt[]>()
  for (const a of latestAttempts(p.quizAttempts).values()) {
    byLesson.set(a.lessonId, [...(byLesson.get(a.lessonId) ?? []), a])
  }
  return new Map([...byLesson].map(([id, list]) => [id, accuracyOf(list)]))
}

export function moduleAccuracy(p: Progress, c: ContentIndex): { module: Module; accuracy: Accuracy }[] {
  const latest = [...latestAttempts(p.quizAttempts).values()]
  return c.modules.map((m) => {
    const ids = new Set(c.lessons.filter((l) => l.moduleId === m.id).map((l) => l.id))
    return { module: m, accuracy: accuracyOf(latest.filter((a) => ids.has(a.lessonId))) }
  })
}

/** Consecutive days with activity, ending today (or yesterday if nothing logged yet today). */
export function streak(activity: Record<string, number>, now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!activity[dayKey(d)]) d.setDate(d.getDate() - 1)
  let count = 0
  while (activity[dayKey(d)]) {
    count++
    d.setDate(d.getDate() - 1)
  }
  return count
}

export interface ReviewItem {
  id: string
  kind: 'flashcard' | 'question'
  lessonId: string
}

/**
 * Items to review now: queued items whose due date has passed, plus flashcards of lessons the
 * learner has started but that were never reviewed (new cards).
 */
export function dueItems(p: Progress, c: ContentIndex, now: Date): ReviewItem[] {
  const items: ReviewItem[] = []
  const qById = new Map(c.questions.map((q) => [q.id, q]))
  for (const [id, card] of Object.entries(p.cards)) {
    if (!isDue(card, now)) continue
    if (id.startsWith('q:')) {
      const q = qById.get(id.slice(2))
      if (q) items.push({ id, kind: 'question', lessonId: q.lessonId })
    } else if (id.startsWith('f:')) {
      const f = c.flashcards.find((x) => x.id === id.slice(2))
      if (f) items.push({ id, kind: 'flashcard', lessonId: f.lessonId })
    }
  }
  for (const f of c.flashcards) {
    if (!p.cards[`f:${f.id}`] && lessonStatus(p, f.lessonId) !== 'not_started') {
      items.push({ id: `f:${f.id}`, kind: 'flashcard', lessonId: f.lessonId })
    }
  }
  return items
}

export interface WeakTopic {
  lesson: Lesson
  accuracy: Accuracy
}

export function weakTopics(p: Progress, c: ContentIndex, threshold = 0.7, minAnswered = 2): WeakTopic[] {
  const acc = lessonAccuracy(p)
  return c.lessons
    .map((lesson) => ({ lesson, accuracy: acc.get(lesson.id) }))
    .filter(
      (w): w is WeakTopic =>
        !!w.accuracy && w.accuracy.answered >= minAnswered && (w.accuracy.rate ?? 1) < threshold,
    )
    .sort((a, b) => (a.accuracy.rate ?? 0) - (b.accuracy.rate ?? 0))
}

/** Where to continue: the last opened lesson if unfinished, else the first unfinished lesson in order. */
export function continueLesson(p: Progress, c: ContentIndex): Lesson | undefined {
  const last = p.lastLessonId ? c.lessons.find((l) => l.id === p.lastLessonId) : undefined
  if (last && lessonStatus(p, last.id) !== 'completed') return last
  const startIdx = last ? c.lessons.indexOf(last) : 0
  const after = c.lessons.slice(startIdx).find((l) => lessonStatus(p, l.id) !== 'completed')
  return after ?? c.lessons.find((l) => lessonStatus(p, l.id) !== 'completed')
}

export type Recommendation =
  | { kind: 'review'; count: number }
  | { kind: 'relearn'; topic: WeakTopic }
  | { kind: 'continue'; lesson: Lesson }
  | { kind: 'done' }

export function recommend(p: Progress, c: ContentIndex, now: Date): Recommendation {
  const due = dueItems(p, c, now).length
  if (due >= 10) return { kind: 'review', count: due }
  const weak = weakTopics(p, c)
  if (weak.length) return { kind: 'relearn', topic: weak[0] }
  const next = continueLesson(p, c)
  if (next) return { kind: 'continue', lesson: next }
  return due ? { kind: 'review', count: due } : { kind: 'done' }
}

export interface DashboardStats {
  totalLessons: number
  completedLessons: number
  inProgress: Lesson[]
  completedVideoSeconds: number
  watchedSeconds: number
  streakDays: number
  activeDays: number
  quiz: Accuracy
  weak: WeakTopic[]
  dueNow: number
  forecast: number[]
  modules: { module: Module; total: number; completed: number }[]
  stagesPassed: number
  totalStages: number
  labPassed: number
  totalExercises: number
  continueAt?: Lesson
  recommendation: Recommendation
}

export function dashboardStats(p: Progress, c: ContentIndex, now: Date): DashboardStats {
  const completed = c.lessons.filter((l) => lessonStatus(p, l.id) === 'completed')
  return {
    totalLessons: c.lessons.length,
    completedLessons: completed.length,
    inProgress: c.lessons.filter((l) => lessonStatus(p, l.id) === 'in_progress'),
    completedVideoSeconds: completed.reduce((s, l) => s + (l.video ? l.video.end - l.video.start : 0), 0),
    watchedSeconds: Object.values(p.lessons).reduce((s, l) => s + l.watchedSeconds, 0),
    streakDays: streak(p.activity, now),
    activeDays: Object.values(p.activity).filter((n) => n > 0).length,
    quiz: accuracyOf(latestAttempts(p.quizAttempts).values()),
    weak: weakTopics(p, c),
    dueNow: dueItems(p, c, now).length,
    forecast: dueForecast(Object.values(p.cards), now),
    modules: c.modules.map((m) => {
      const ls = c.lessons.filter((l) => l.moduleId === m.id)
      return {
        module: m,
        total: ls.length,
        completed: ls.filter((l) => lessonStatus(p, l.id) === 'completed').length,
      }
    }),
    stagesPassed: c.stages.filter((s) => p.lab[s.exercise.id]?.passed).length,
    totalStages: c.stages.length,
    labPassed: c.exercises.filter((e) => p.lab[e.id]?.passed).length,
    totalExercises: c.exercises.length,
    continueAt: continueLesson(p, c),
    recommendation: recommend(p, c, now),
  }
}

/** Questions whose latest attempt was wrong. */
export function wrongQuestions(p: Progress, c: ContentIndex): Question[] {
  const latest = latestAttempts(p.quizAttempts)
  return c.questions.filter((q) => latest.get(q.id)?.correct === false)
}

/** Lessons that need review: has a wrong latest answer or a due review item. */
export function lessonsNeedingReview(p: Progress, c: ContentIndex, now: Date): Set<string> {
  const ids = new Set(wrongQuestions(p, c).map((q) => q.lessonId))
  for (const item of dueItems(p, c, now)) if (p.cards[item.id]) ids.add(item.lessonId)
  return ids
}
