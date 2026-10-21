import { describe, expect, it } from 'vitest'
import { dueForecast, isDue, newCard, review } from './leitner'

const NOW = new Date('2026-10-21T08:00:00')
const DAY = 86_400_000

describe('Leitner scheduling', () => {
  it('a new card answered correctly goes to box 2, due in 2 days', () => {
    const c = review(undefined, true, NOW)
    expect(c.box).toBe(2)
    expect(Date.parse(c.due) - NOW.getTime()).toBe(2 * DAY)
    expect(c.reviews).toBe(1)
  })

  it('correct answers move up one box at a time and stop at 5', () => {
    let c = newCard(NOW)
    c = review(c, true, NOW)
    expect(c.box).toBe(2)
    for (let i = 0; i < 6; i++) c = review(c, true, NOW)
    expect(c.box).toBe(5)
    expect(Date.parse(c.due) - NOW.getTime()).toBe(16 * DAY)
  })

  it('a wrong answer resets to box 1, due in 10 minutes, and counts a lapse', () => {
    const c = review({ box: 4, due: NOW.toISOString(), reviews: 3, lapses: 0 }, false, NOW)
    expect(c).toMatchObject({ box: 1, reviews: 4, lapses: 1 })
    expect(Date.parse(c.due) - NOW.getTime()).toBe(10 * 60 * 1000)
  })

  it('isDue compares with now', () => {
    expect(isDue(newCard(NOW), NOW)).toBe(true)
    expect(isDue(review(undefined, true, NOW), NOW)).toBe(false)
  })

  it('forecasts due items per day, counting overdue cards as today', () => {
    const at = (days: number) => ({
      box: 1,
      due: new Date(NOW.getTime() + days * DAY).toISOString(),
      reviews: 0,
      lapses: 0,
    })
    expect(dueForecast([at(-3), at(0), at(1), at(1), at(6), at(30)], NOW)).toEqual([2, 2, 0, 0, 0, 0, 1])
  })
})
