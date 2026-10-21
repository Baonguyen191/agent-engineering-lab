import type { Question } from '../../content/types'

/** What the learner submitted, by question type. `order` = original item indexes in the learner's order. */
export type QuizResponse =
  | { type: 'single'; choice: number }
  | { type: 'multi'; choices: number[] }
  | { type: 'truefalse'; value: boolean }
  | { type: 'fill'; text: string }
  | { type: 'order'; order: number[] }

export interface GradeResult {
  correct: boolean
  /** Human-readable correct answer. */
  expected: string
}

/** Normalise free-text answers: case, surrounding backticks/quotes, trailing "()", whitespace. */
export function normalizeFill(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^[`'"]+|[`'"]+$/g, '')
    .replace(/\(\)$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

export function grade(q: Question, r: QuizResponse): GradeResult {
  if (q.type !== r.type)
    throw new Error(`Response type ${r.type} does not match question ${q.id} (${q.type})`)
  switch (q.type) {
    case 'single':
      return { correct: (r as { choice: number }).choice === q.answer, expected: q.options[q.answer] }
    case 'multi':
      return {
        correct: sameSet((r as { choices: number[] }).choices, q.answer),
        expected: q.answer.map((i) => q.options[i]).join(' · '),
      }
    case 'truefalse':
      return { correct: (r as { value: boolean }).value === q.answer, expected: q.answer ? 'Đúng' : 'Sai' }
    case 'fill': {
      const given = normalizeFill((r as { text: string }).text)
      return {
        correct: given !== '' && q.accept.some((a) => normalizeFill(a) === given),
        expected: q.accept[0],
      }
    }
    case 'order': {
      const order = (r as { order: number[] }).order
      return {
        correct: order.length === q.items.length && order.every((v, i) => v === i),
        expected: q.items.map((it, i) => `${i + 1}. ${it}`).join('\n'),
      }
    }
  }
}

/** Deterministic shuffle (so a question keeps the same order while it is on screen). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // Never present an ordering question already solved.
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift() as T)
  return out
}
