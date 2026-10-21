import { m1Flashcards, m1Questions } from './bank/m1'
import { m2Flashcards, m2Questions } from './bank/m2'
import { m3Flashcards, m3Questions } from './bank/m3'
import { m4Flashcards, m4Questions } from './bank/m4'
import { m5Flashcards, m5Questions } from './bank/m5'
import { m6Flashcards, m6Questions } from './bank/m6'
import { m7Flashcards, m7Questions } from './bank/m7'
import { m8Flashcards, m8Questions } from './bank/m8'
import { modules } from './course'
import { exercises } from './exercises'
import { m1Lessons } from './modules/m1-langchain'
import { m2Lessons } from './modules/m2-langgraph'
import { m3Lessons } from './modules/m3-rag'
import { m4Lessons } from './modules/m4-vectorless'
import { m5Lessons } from './modules/m5-deep-agents'
import { m6Lessons } from './modules/m6-guardrails'
import { m7Lessons } from './modules/m7-evaluation'
import { m8Lessons } from './modules/m8-gateway'
import { projectStages } from './project'
import type { Exercise, Flashcard, Lesson, LessonMeta, Module, ProjectStage, Question } from './types'

const bodyFiles = import.meta.glob('./modules/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Split a module Markdown file on "<!-- lesson: <id> -->" markers. */
export function splitLessonBodies(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const parts = text.split(/^<!--\s*lesson:\s*([\w-]+)\s*-->\s*$/m)
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1].trim()
  return out
}

const bodies: Record<string, string> = Object.assign({}, ...Object.values(bodyFiles).map(splitLessonBodies))

const lessonMetaByModule: Record<string, LessonMeta[]> = {
  m1: m1Lessons,
  m2: m2Lessons,
  m3: m3Lessons,
  m4: m4Lessons,
  m5: m5Lessons,
  m6: m6Lessons,
  m7: m7Lessons,
  m8: m8Lessons,
}

export { modules, exercises, projectStages }

export const lessons: Lesson[] = modules.flatMap((m) =>
  (lessonMetaByModule[m.id] ?? []).map((meta) => ({ ...meta, moduleId: m.id, body: bodies[meta.id] ?? '' })),
)

export const questions: Question[] = [
  ...m1Questions,
  ...m2Questions,
  ...m3Questions,
  ...m4Questions,
  ...m5Questions,
  ...m6Questions,
  ...m7Questions,
  ...m8Questions,
]
export const flashcards: Flashcard[] = [
  ...m1Flashcards,
  ...m2Flashcards,
  ...m3Flashcards,
  ...m4Flashcards,
  ...m5Flashcards,
  ...m6Flashcards,
  ...m7Flashcards,
  ...m8Flashcards,
]

const lessonById = new Map(lessons.map((l) => [l.id, l]))
const moduleById = new Map(modules.map((m) => [m.id, m]))
const exerciseById = new Map(exercises.map((e) => [e.id, e]))
const questionById = new Map(questions.map((q) => [q.id, q]))
const stageById = new Map(projectStages.map((s) => [s.id, s]))

export const getLesson = (id: string): Lesson | undefined => lessonById.get(id)
export const getModule = (id: string): Module | undefined => moduleById.get(id)
export const getExercise = (id: string): Exercise | undefined => exerciseById.get(id)
export const getQuestion = (id: string): Question | undefined => questionById.get(id)
export const getStage = (id: string): ProjectStage | undefined => stageById.get(id)

export const lessonsOfModule = (moduleId: string): Lesson[] => lessons.filter((l) => l.moduleId === moduleId)
export const questionsOfLesson = (lessonId: string): Question[] =>
  questions.filter((q) => q.lessonId === lessonId)
export const flashcardsOfLesson = (lessonId: string): Flashcard[] =>
  flashcards.filter((f) => f.lessonId === lessonId)
export const questionsOfModule = (moduleId: string): Question[] => {
  const ids = new Set(lessonsOfModule(moduleId).map((l) => l.id))
  return questions.filter((q) => ids.has(q.lessonId))
}

/** Lessons in curriculum order, used for prev/next navigation and recommendations. */
export function adjacentLessons(id: string): { prev?: Lesson; next?: Lesson } {
  const i = lessons.findIndex((l) => l.id === id)
  return { prev: i > 0 ? lessons[i - 1] : undefined, next: i >= 0 ? lessons[i + 1] : undefined }
}

/** Everything the progress selectors need, in one object. */
export const contentIndex = { modules, lessons, questions, flashcards, exercises, stages: projectStages }

/** Seconds of video covered by a lesson (0 for supplement lessons). */
export const lessonVideoSeconds = (l: Lesson): number => (l.video ? l.video.end - l.video.start : 0)
