import type { Exercise, Flashcard, Lesson, Module, ProjectStage, Question } from './types'

export interface ContentToValidate {
  modules: Module[]
  lessons: Lesson[]
  questions: Question[]
  flashcards: Flashcard[]
  exercises: Exercise[]
  stages: ProjectStage[]
  videoDuration: number
}

const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i)

/**
 * Integrity checks for course content. Returns human-readable problems; empty array = valid.
 * Run by src/content/content.test.ts so broken references or answer keys fail CI.
 */
export function validateContent(c: ContentToValidate): string[] {
  const errors: string[] = []
  const err = (msg: string) => errors.push(msg)
  const lessonIds = new Set(c.lessons.map((l) => l.id))
  const exerciseIds = new Set(c.exercises.map((e) => e.id))
  const stageIds = new Set(c.stages.map((s) => s.id))

  for (const [kind, ids] of [
    ['lesson', c.lessons.map((l) => l.id)],
    ['question', c.questions.map((q) => q.id)],
    ['flashcard', c.flashcards.map((f) => f.id)],
    ['exercise', c.exercises.map((e) => e.id)],
  ] as const) {
    for (const d of dupes(ids)) err(`duplicate ${kind} id: ${d}`)
  }

  for (const m of c.modules) {
    if (m.video.start >= m.video.end || m.video.end > c.videoDuration) err(`module ${m.id}: bad video range`)
    for (const s of m.miniProject.stageIds) if (!stageIds.has(s)) err(`module ${m.id}: unknown stage ${s}`)
    if (!c.lessons.some((l) => l.moduleId === m.id)) err(`module ${m.id}: no lessons`)
    if (!c.exercises.some((e) => e.moduleId === m.id)) err(`module ${m.id}: no exercise`)
  }

  for (const l of c.lessons) {
    const m = c.modules.find((x) => x.id === l.moduleId)
    if (!l.body.trim()) err(`lesson ${l.id}: empty body`)
    if ((l.body.match(/^```/gm) ?? []).length % 2) err(`lesson ${l.id}: unbalanced code fences`)
    if (!l.objectives.length || !l.checklist.length) err(`lesson ${l.id}: missing objectives/checklist`)
    if (l.source === 'video' && !l.video) err(`lesson ${l.id}: video lesson without segment`)
    if (l.source === 'supplement' && l.video)
      err(`lesson ${l.id}: supplement lesson must not claim a video segment`)
    if (
      l.video &&
      m &&
      (l.video.start < m.video.start || l.video.end > m.video.end || l.video.start >= l.video.end)
    )
      err(`lesson ${l.id}: video segment outside module ${m.id}`)
    for (const match of l.body.matchAll(/\]\(#t=(\d+)\)/g)) {
      const t = Number(match[1])
      if (!l.video) err(`lesson ${l.id}: timestamp link #t=${t} but no video segment`)
      else if (t < l.video.start - 60 || t > l.video.end + 60)
        err(`lesson ${l.id}: timestamp #t=${t} outside its segment`)
    }
    for (const e of l.exercises ?? []) if (!exerciseIds.has(e)) err(`lesson ${l.id}: unknown exercise ${e}`)
    const qCount = c.questions.filter((q) => q.lessonId === l.id).length
    if (qCount < 5 || qCount > 10) err(`lesson ${l.id}: has ${qCount} questions (expected 5-10)`)
    if (!c.flashcards.some((f) => f.lessonId === l.id)) err(`lesson ${l.id}: no flashcards`)
  }

  for (const q of c.questions) {
    if (!lessonIds.has(q.lessonId)) err(`question ${q.id}: unknown lesson ${q.lessonId}`)
    if (!q.prompt.trim() || !q.explanation.trim()) err(`question ${q.id}: missing prompt/explanation`)
    if (q.type === 'single') {
      if (q.options.length < 2 || q.answer < 0 || q.answer >= q.options.length)
        err(`question ${q.id}: bad answer index`)
      if (q.whyNot && q.whyNot.length !== q.options.length) err(`question ${q.id}: whyNot length mismatch`)
      if (q.whyNot && q.whyNot[q.answer]) err(`question ${q.id}: whyNot explains the correct option`)
    }
    if (q.type === 'multi') {
      if (!q.answer.length || q.answer.some((i) => i < 0 || i >= q.options.length))
        err(`question ${q.id}: bad answers`)
      if (q.whyNot && q.whyNot.length !== q.options.length) err(`question ${q.id}: whyNot length mismatch`)
    }
    if (q.type === 'fill' && !q.accept.length) err(`question ${q.id}: no accepted answers`)
    if (q.type === 'order' && q.items.length < 3) err(`question ${q.id}: ordering needs 3+ items`)
  }

  for (const f of c.flashcards)
    if (!lessonIds.has(f.lessonId)) err(`flashcard ${f.id}: unknown lesson ${f.lessonId}`)

  for (const e of c.exercises) {
    for (const l of e.lessonIds) if (!lessonIds.has(l)) err(`exercise ${e.id}: unknown lesson ${l}`)
    if (!/^def test_/m.test(e.tests)) err(`exercise ${e.id}: no tests`)
    if (!e.hints.length) err(`exercise ${e.id}: no hints`)
    if (e.usesLLM && !/get_chat_model/.test(e.starter))
      err(`exercise ${e.id}: usesLLM but starter never calls get_chat_model`)
  }

  if (c.stages.length !== 10) err(`expected 10 project stages, got ${c.stages.length}`)
  c.stages.forEach((s, i) => {
    if (s.index !== i + 1) err(`stage ${s.id}: index out of order`)
    if (!s.checklist.length || !s.criteria.length || !s.pitfalls.length) err(`stage ${s.id}: incomplete`)
  })
  return errors
}
