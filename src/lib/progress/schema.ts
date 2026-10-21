import { z } from 'zod'

/** localStorage key. Bump the suffix together with `version` and add a migration in store.ts. */
export const STORAGE_KEY = 'ael:progress:v1'

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO date')

export const lessonProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  startedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
  /** Last known video position in seconds (absolute position in the course video). */
  lastPosition: z.number().nonnegative().optional(),
  /** Seconds of video actually played inside this lesson's segment, measured by the player. */
  watchedSeconds: z.number().nonnegative(),
  notes: z.string(),
  checklist: z.record(z.string(), z.boolean()),
  bookmarks: z.array(z.object({ t: z.number().nonnegative(), label: z.string() })),
})

export const quizAttemptSchema = z.object({
  questionId: z.string(),
  lessonId: z.string(),
  correct: z.boolean(),
  at: isoDate,
})

/** Leitner box state for a review item. Item ids: "f:<flashcardId>" or "q:<questionId>". */
export const cardStateSchema = z.object({
  box: z.number().int().min(1).max(5),
  due: isoDate,
  reviews: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReviewed: isoDate.optional(),
})

export const labProgressSchema = z.object({
  code: z.string(),
  passed: z.boolean(),
  /** Best number of passing tests seen so far, out of `total`. */
  bestPassed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  lastRunAt: isoDate.optional(),
  hintsShown: z.number().int().nonnegative(),
  solutionViewed: z.boolean(),
})

export const stageProgressSchema = z.object({
  checklist: z.record(z.string(), z.boolean()),
})

export const progressSchema = z.object({
  version: z.literal(1),
  lessons: z.record(z.string(), lessonProgressSchema),
  quizAttempts: z.array(quizAttemptSchema),
  cards: z.record(z.string(), cardStateSchema),
  lab: z.record(z.string(), labProgressSchema),
  stages: z.record(z.string(), stageProgressSchema),
  /** Local calendar day "YYYY-MM-DD" -> number of learning actions that day. */
  activity: z.record(z.string(), z.number().int().nonnegative()),
  lastLessonId: z.string().optional(),
})

export type LessonProgress = z.infer<typeof lessonProgressSchema>
export type QuizAttempt = z.infer<typeof quizAttemptSchema>
export type CardState = z.infer<typeof cardStateSchema>
export type LabProgress = z.infer<typeof labProgressSchema>
export type StageProgress = z.infer<typeof stageProgressSchema>
export type Progress = z.infer<typeof progressSchema>

export const emptyProgress = (): Progress => ({
  version: 1,
  lessons: {},
  quizAttempts: [],
  cards: {},
  lab: {},
  stages: {},
  activity: {},
})

export const emptyLessonProgress = (): LessonProgress => ({
  status: 'not_started',
  watchedSeconds: 0,
  notes: '',
  checklist: {},
  bookmarks: [],
})
