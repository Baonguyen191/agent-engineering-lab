import { describe, expect, it } from 'vitest'
import { VIDEO } from './course'
import { exerciseIdsInSource, exercises, parseExerciseFile } from './exercises'
import { contentIndex, lessons, modules, questions, splitLessonBodies } from './index'
import { validateContent } from './validate'

describe('course content', () => {
  it('passes every integrity check', () => {
    expect(validateContent({ ...contentIndex, videoDuration: VIDEO.durationSeconds })).toEqual([])
  })

  it('covers the 8 modules of the course in video order', () => {
    expect(modules.map((m) => m.shortTitle)).toEqual([
      'LangChain',
      'LangGraph',
      'RAG',
      'Vectorless RAG',
      'Deep Agents',
      'Guardrails',
      'Evaluation',
      'Gateways',
    ])
    // Module ranges follow the official chapter list; module 1 also includes the introduction.
    expect(modules.map((m) => m.video.start)).toEqual([0, ...VIDEO.chapters.slice(2).map((c) => c.start)])
  })

  it('video lessons of a module tile its segment without gaps or overlaps', () => {
    for (const m of modules) {
      const segs = lessons.filter((l) => l.moduleId === m.id && l.video).map((l) => l.video!)
      for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end)
      expect(segs.at(-1)!.end).toBe(m.video.end)
    }
  })

  it('has a substantial question bank', () => {
    expect(questions.length).toBeGreaterThanOrEqual(150)
    const kinds = new Set(questions.map((q) => q.type))
    expect([...kinds].sort()).toEqual(['fill', 'multi', 'order', 'single', 'truefalse'])
  })

  it('registers every exercise found in the Python sources', () => {
    expect(exercises.map((e) => e.id).sort()).toEqual([...exerciseIdsInSource].sort())
  })
})

describe('content parsers', () => {
  it('splits lesson bodies on markers', () => {
    expect(splitLessonBodies('<!-- lesson: a -->\nA body\n<!-- lesson: b -->\nB body\n')).toEqual({
      a: 'A body',
      b: 'B body',
    })
  })

  it('splits exercise files into sections', () => {
    const parsed = parseExerciseFile(
      '# @@x:starter\nS\n# @@x:solution\nSol\n# @@x:tests\nT\n# @@y:starter\nY\n',
    )
    expect(parsed.x).toEqual({ starter: 'S\n', solution: 'Sol\n', tests: 'T\n' })
    expect(parsed.y.starter).toBe('Y\n')
  })
})
