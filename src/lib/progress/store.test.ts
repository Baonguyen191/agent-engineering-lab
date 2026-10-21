import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY, emptyProgress } from './schema'
import {
  __setTestState,
  exportProgress,
  flush,
  getProgress,
  importProgress,
  openLesson,
  recordLabRun,
  recordQuizAnswer,
  resetProgress,
  reviewItem,
  setLessonCompleted,
  setNotes,
} from './store'

const NOW = new Date('2026-10-21T10:00:00')

beforeEach(() => {
  __setTestState(emptyProgress(), () => NOW)
})

describe('progress store', () => {
  it('opening a lesson marks it in progress and remembers it, without counting activity', () => {
    openLesson('lc-agents')
    const p = getProgress()
    expect(p.lessons['lc-agents'].status).toBe('in_progress')
    expect(p.lastLessonId).toBe('lc-agents')
    expect(p.activity).toEqual({})
  })

  it('completing a lesson records the date and today’s activity', () => {
    setLessonCompleted('lc-agents', true)
    expect(getProgress().lessons['lc-agents']).toMatchObject({
      status: 'completed',
      completedAt: NOW.toISOString(),
    })
    expect(getProgress().activity['2026-10-21']).toBe(1)
    setLessonCompleted('lc-agents', false)
    expect(getProgress().lessons['lc-agents'].status).toBe('in_progress')
  })

  it('a wrong quiz answer queues the question for review; a correct one does not', () => {
    recordQuizAnswer('q1', 'lc-agents', true)
    expect(getProgress().cards['q:q1']).toBeUndefined()
    recordQuizAnswer('q1', 'lc-agents', false)
    expect(getProgress().cards['q:q1']).toMatchObject({ box: 1, lapses: 1 })
    recordQuizAnswer('q1', 'lc-agents', true)
    expect(getProgress().cards['q:q1'].box).toBe(2)
    expect(getProgress().quizAttempts).toHaveLength(3)
  })

  it('reviewing a flashcard schedules it', () => {
    reviewItem('f:lc-f1', true)
    expect(getProgress().cards['f:lc-f1'].box).toBe(2)
  })

  it('lab runs keep the best score and passed flag', () => {
    recordLabRun('ex', 'code v1', 3, 7)
    recordLabRun('ex', 'code v2', 7, 7)
    recordLabRun('ex', 'code v3', 2, 7)
    expect(getProgress().lab.ex).toMatchObject({
      passed: true,
      bestPassed: 7,
      total: 7,
      attempts: 3,
      code: 'code v3',
    })
  })

  it('persists to localStorage and survives export → reset → import', () => {
    setNotes('lc-agents', 'ghi chú')
    setLessonCompleted('lc-intro', true)
    flush()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lessons['lc-agents'].notes).toBe('ghi chú')

    const backup = exportProgress()
    expect(backup).not.toMatch(/apiKey|api_key/)
    resetProgress()
    expect(getProgress().lessons).toEqual({})
    expect(importProgress(backup)).toBeNull()
    expect(getProgress().lessons['lc-intro'].status).toBe('completed')
    expect(getProgress().lessons['lc-agents'].notes).toBe('ghi chú')
  })

  it('rejects invalid imports without touching current data', () => {
    setLessonCompleted('lc-intro', true)
    expect(importProgress('not json')).toMatch(/JSON/)
    expect(importProgress(JSON.stringify({ progress: { version: 2 } }))).toMatch(/định dạng/)
    expect(getProgress().lessons['lc-intro'].status).toBe('completed')
  })
})
