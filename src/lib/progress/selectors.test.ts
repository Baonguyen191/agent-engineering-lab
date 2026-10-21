import { describe, expect, it } from 'vitest'
import { contentIndex, flashcardsOfLesson, lessons } from '../../content'
import { emptyLessonProgress, emptyProgress, type Progress } from './schema'
import {
  continueLesson,
  dashboardStats,
  dueItems,
  latestAttempts,
  recommend,
  streak,
  weakTopics,
  wrongQuestions,
} from './selectors'

const NOW = new Date('2026-10-21T10:00:00')
const iso = NOW.toISOString()

function withLessons(p: Progress, entries: Record<string, 'in_progress' | 'completed'>): Progress {
  const out = { ...p, lessons: { ...p.lessons } }
  for (const [id, status] of Object.entries(entries)) out.lessons[id] = { ...emptyLessonProgress(), status }
  return out
}

describe('progress selectors', () => {
  it('empty progress: nothing completed, start at the first lesson, no fake numbers', () => {
    const s = dashboardStats(emptyProgress(), contentIndex, NOW)
    expect(s.completedLessons).toBe(0)
    expect(s.completedVideoSeconds).toBe(0)
    expect(s.streakDays).toBe(0)
    expect(s.quiz.rate).toBeNull()
    expect(s.dueNow).toBe(0)
    expect(s.continueAt?.id).toBe(lessons[0].id)
    expect(s.recommendation).toEqual({ kind: 'continue', lesson: lessons[0] })
  })

  it('completed video time sums the segments of completed lessons', () => {
    const [a, b] = lessons
    const s = dashboardStats(
      withLessons(emptyProgress(), { [a.id]: 'completed', [b.id]: 'completed' }),
      contentIndex,
      NOW,
    )
    expect(s.completedLessons).toBe(2)
    expect(s.completedVideoSeconds).toBe(a.video!.end - a.video!.start + (b.video!.end - b.video!.start))
  })

  it('continues the last opened lesson, or the next unfinished one after it', () => {
    const p = {
      ...withLessons(emptyProgress(), { [lessons[3].id]: 'in_progress' }),
      lastLessonId: lessons[3].id,
    }
    expect(continueLesson(p, contentIndex)?.id).toBe(lessons[3].id)
    const done = {
      ...withLessons(emptyProgress(), { [lessons[3].id]: 'completed' }),
      lastLessonId: lessons[3].id,
    }
    expect(continueLesson(done, contentIndex)?.id).toBe(lessons[4].id)
  })

  it('uses the latest attempt per question for accuracy and wrong lists', () => {
    const q = contentIndex.questions[0]
    const p: Progress = {
      ...emptyProgress(),
      quizAttempts: [
        { questionId: q.id, lessonId: q.lessonId, correct: false, at: iso },
        { questionId: q.id, lessonId: q.lessonId, correct: true, at: iso },
      ],
    }
    expect(latestAttempts(p.quizAttempts).get(q.id)?.correct).toBe(true)
    expect(wrongQuestions(p, contentIndex)).toEqual([])
    expect(dashboardStats(p, contentIndex, NOW).quiz).toEqual({ answered: 1, correct: 1, rate: 1 })
  })

  it('flags a lesson as weak below 70% with at least 2 answers and recommends relearning it', () => {
    const qs = contentIndex.questions.filter((x) => x.lessonId === 'lc-models').slice(0, 3)
    const p: Progress = {
      ...emptyProgress(),
      quizAttempts: qs.map((q, i) => ({ questionId: q.id, lessonId: q.lessonId, correct: i === 0, at: iso })),
    }
    const weak = weakTopics(p, contentIndex)
    expect(weak.map((w) => w.lesson.id)).toEqual(['lc-models'])
    expect(weak[0].accuracy.rate).toBeCloseTo(1 / 3)
    expect(recommend(p, contentIndex, NOW)).toMatchObject({ kind: 'relearn' })
  })

  it('due items: queued wrong questions plus new flashcards of started lessons', () => {
    const q = contentIndex.questions[0]
    const p: Progress = {
      ...withLessons(emptyProgress(), { 'lc-agents': 'in_progress' }),
      cards: {
        [`q:${q.id}`]: { box: 1, due: new Date(NOW.getTime() - 1000).toISOString(), reviews: 1, lapses: 1 },
      },
    }
    const ids = dueItems(p, contentIndex, NOW).map((i) => i.id)
    expect(ids).toContain(`q:${q.id}`)
    for (const f of flashcardsOfLesson('lc-agents')) expect(ids).toContain(`f:${f.id}`)
    expect(ids.some((id) => id.startsWith('f:lg-'))).toBe(false)
  })

  it('recommends reviewing first when 10 or more items are due', () => {
    const cards = Object.fromEntries(
      contentIndex.flashcards
        .slice(0, 10)
        .map((f) => [`f:${f.id}`, { box: 1, due: iso, reviews: 1, lapses: 0 }]),
    )
    expect(recommend({ ...emptyProgress(), cards }, contentIndex, NOW)).toEqual({ kind: 'review', count: 10 })
  })

  it('streak counts consecutive active days ending today or yesterday', () => {
    expect(streak({ '2026-10-21': 2, '2026-10-20': 1, '2026-10-19': 4, '2026-10-17': 1 }, NOW)).toBe(3)
    expect(streak({ '2026-10-20': 1, '2026-10-19': 1 }, NOW)).toBe(2)
    expect(streak({ '2026-10-18': 1 }, NOW)).toBe(0)
  })
})
