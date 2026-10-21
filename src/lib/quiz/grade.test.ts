import { describe, expect, it } from 'vitest'
import { questions } from '../../content'
import type { Question } from '../../content/types'
import { grade, normalizeFill, seededShuffle } from './grade'

const base = { id: 'q', lessonId: 'l', kind: 'concept' as const, prompt: 'p', explanation: 'e' }

describe('grade', () => {
  it('single choice', () => {
    const q: Question = { ...base, type: 'single', options: ['a', 'b', 'c'], answer: 1 }
    expect(grade(q, { type: 'single', choice: 1 }).correct).toBe(true)
    expect(grade(q, { type: 'single', choice: 0 })).toEqual({ correct: false, expected: 'b' })
  })

  it('multi choice requires the exact set, in any order', () => {
    const q: Question = { ...base, type: 'multi', options: ['a', 'b', 'c', 'd'], answer: [0, 2] }
    expect(grade(q, { type: 'multi', choices: [2, 0] }).correct).toBe(true)
    expect(grade(q, { type: 'multi', choices: [0] }).correct).toBe(false)
    expect(grade(q, { type: 'multi', choices: [0, 2, 3] }).correct).toBe(false)
  })

  it('true/false', () => {
    const q: Question = { ...base, type: 'truefalse', answer: false }
    expect(grade(q, { type: 'truefalse', value: false }).correct).toBe(true)
    expect(grade(q, { type: 'truefalse', value: true })).toEqual({ correct: false, expected: 'Sai' })
  })

  it('fill accepts normalised variants but not empty answers', () => {
    const q: Question = { ...base, type: 'fill', accept: ['init_chat_model'] }
    for (const t of ['init_chat_model', '  INIT_CHAT_MODEL ', '`init_chat_model()`']) {
      expect(grade(q, { type: 'fill', text: t }).correct).toBe(true)
    }
    expect(grade(q, { type: 'fill', text: '' }).correct).toBe(false)
    expect(grade(q, { type: 'fill', text: 'init_model' }).correct).toBe(false)
  })

  it('order must match exactly', () => {
    const q: Question = { ...base, type: 'order', items: ['a', 'b', 'c'] }
    expect(grade(q, { type: 'order', order: [0, 1, 2] }).correct).toBe(true)
    expect(grade(q, { type: 'order', order: [1, 0, 2] }).correct).toBe(false)
  })

  it('rejects a response of the wrong type', () => {
    const q: Question = { ...base, type: 'truefalse', answer: true }
    expect(() => grade(q, { type: 'single', choice: 0 })).toThrow()
  })

  it('the answer key of every question in the bank grades as correct', () => {
    for (const q of questions) {
      const r =
        q.type === 'single'
          ? grade(q, { type: 'single', choice: q.answer })
          : q.type === 'multi'
            ? grade(q, { type: 'multi', choices: q.answer })
            : q.type === 'truefalse'
              ? grade(q, { type: 'truefalse', value: q.answer })
              : q.type === 'fill'
                ? grade(q, { type: 'fill', text: q.accept[0] })
                : grade(q, { type: 'order', order: q.items.map((_, i) => i) })
      expect(r.correct, q.id).toBe(true)
    }
  })
})

describe('helpers', () => {
  it('normalizeFill', () => {
    expect(normalizeFill(' `Command()` ')).toBe('command')
    expect(normalizeFill('a   b')).toBe('a b')
  })

  it('seededShuffle is deterministic and never returns the solved order', () => {
    const items = [0, 1, 2, 3, 4]
    expect(seededShuffle(items, 'x')).toEqual(seededShuffle(items, 'x'))
    expect(seededShuffle(items, 'x').sort()).toEqual(items)
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
      expect(seededShuffle(items, seed)).not.toEqual(items)
  })
})
