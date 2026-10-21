import type { Lesson, Module } from '../content/types'
import { fold } from './format'

/**
 * Lesson search over title, summary, tags, objectives and module name.
 * Every query word must match somewhere (accent-insensitive). Results ranked by where they match.
 */
export function searchLessons(lessons: Lesson[], modules: Module[], query: string): Lesson[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return lessons
  const moduleName = new Map(modules.map((m) => [m.id, `${m.title} ${m.shortTitle}`]))
  const scored = lessons
    .map((l) => {
      const title = fold(l.title)
      const tags = fold(l.tags.join(' '))
      const rest = fold(
        `${l.summary} ${l.objectives.join(' ')} ${moduleName.get(l.moduleId) ?? ''} ${l.body}`,
      )
      let score = 0
      for (const w of words) {
        if (title.includes(w)) score += 5
        else if (tags.includes(w)) score += 3
        else if (rest.includes(w)) score += 1
        else return null
      }
      return { l, score }
    })
    .filter((x): x is { l: Lesson; score: number } => x !== null)
  return scored.sort((a, b) => b.score - a.score).map((x) => x.l)
}
