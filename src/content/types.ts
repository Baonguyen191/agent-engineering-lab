/**
 * Content schema. All course material is plain data so it can be validated,
 * tested and extended without touching UI components.
 */

/** Where the lesson's material comes from. */
export type LessonSource =
  /** Maps to a segment of the original video. Explanations are still written by this app. */
  | 'video'
  /** Not covered (or only mentioned) in the video; written to fill a gap in the curriculum. */
  | 'supplement'

export interface VideoSegment {
  /** Seconds from the start of the video. */
  start: number
  end: number
  /**
   * 'official' = chapter timestamp from the video description.
   * 'transcript' = located by searching the auto-generated transcript, accurate to roughly ±1 minute.
   */
  precision: 'official' | 'transcript'
}

export interface Lesson {
  id: string
  moduleId: string
  title: string
  summary: string
  source: LessonSource
  /** Missing for supplement lessons that have no matching video segment. */
  video?: VideoSegment
  /** Reading + practice time, in minutes, excluding the video. */
  studyMinutes: number
  objectives: string[]
  /** Searchable keywords: frameworks, APIs, terms. */
  tags: string[]
  /**
   * Lesson body in Markdown (GFM). Supported fenced extensions:
   * ```flow  -> diagram, one step per line, "A -> B" edges
   * ```selfcheck -> "Q: ..." / "A: ..." pairs rendered as reveal cards
   * Links of the form [label](#t=SECONDS) seek the video.
   */
  body: string
  checklist: string[]
  /** Exercise ids in the Coding Lab that practise this lesson. */
  exercises?: string[]
  references: { label: string; url: string }[]
}

/** Lesson as authored in src/content/modules/*.ts; body and moduleId are attached in src/content/index.ts. */
export type LessonMeta = Omit<Lesson, 'body' | 'moduleId'>

export interface Module {
  id: string
  index: number
  title: string
  shortTitle: string
  description: string
  goals: string[]
  prerequisites: string[]
  video: VideoSegment
  /** Repository / notebook used in the video for this module. */
  repo?: { label: string; url: string }
  miniProject: { title: string; brief: string; stageIds: string[] }
}

export type QuestionKind =
  'concept' | 'predict-output' | 'find-bug' | 'architecture' | 'system-design' | 'terminology' | 'ordering'

interface QuestionBase {
  id: string
  lessonId: string
  kind: QuestionKind
  prompt: string
  /** Optional code shown with the prompt (Python unless stated). */
  code?: string
  explanation: string
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: 'single'
  options: string[]
  answer: number
  /** Why each wrong option is wrong, aligned with `options`. Empty string for the right answer. */
  whyNot?: string[]
}

export interface MultiChoiceQuestion extends QuestionBase {
  type: 'multi'
  options: string[]
  /** Indexes of every correct option. */
  answer: number[]
  whyNot?: string[]
}

export interface TrueFalseQuestion extends QuestionBase {
  type: 'truefalse'
  answer: boolean
}

export interface FillQuestion extends QuestionBase {
  type: 'fill'
  /** Accepted answers; compared case-insensitively after normalisation. */
  accept: string[]
  placeholder?: string
}

export interface OrderQuestion extends QuestionBase {
  type: 'order'
  /** Items listed in the correct order. The UI shuffles them. */
  items: string[]
}

export type Question =
  SingleChoiceQuestion | MultiChoiceQuestion | TrueFalseQuestion | FillQuestion | OrderQuestion

export interface Flashcard {
  id: string
  lessonId: string
  front: string
  back: string
}

/** A Python exercise that runs in the browser (Pyodide) against visible tests. */
export interface Exercise {
  id: string
  title: string
  moduleId: string
  lessonIds: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  /** Markdown task description. */
  brief: string
  /** What the solution must produce, shown as a bullet list. */
  requirements: string[]
  starter: string
  solution: string
  tests: string
  hints: string[]
  /** Extra Pyodide packages to load, e.g. 'pydantic'. */
  packages?: string[]
  /** True if the exercise calls labkit.llm.get_chat_model and can therefore run against a real API. */
  usesLLM?: boolean
}

export interface ProjectStage {
  id: string
  index: number
  title: string
  moduleIds: string[]
  goal: string
  concepts: string[]
  deliverable: string[]
  checklist: string[]
  criteria: string[]
  pitfalls: string[]
  improvements: string[]
  /** Browser-runnable exercise for the stage. */
  exercise: Exercise
  /** Reference code for the real stack, to run locally. Not executed in the browser. */
  localCode?: { title: string; install: string; code: string }
}
