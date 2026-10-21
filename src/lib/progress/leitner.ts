import type { CardState } from './schema'

/**
 * Leitner system with 5 boxes. A correct answer moves the item up one box and schedules it
 * INTERVAL_DAYS[box] days later; a wrong answer sends it back to box 1, due again in 10 minutes.
 */
export const INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }
export const RELEARN_MINUTES = 10

const DAY = 24 * 60 * 60 * 1000

export function newCard(now: Date): CardState {
  return { box: 1, due: now.toISOString(), reviews: 0, lapses: 0 }
}

export function review(card: CardState | undefined, correct: boolean, now: Date): CardState {
  const prev = card ?? newCard(now)
  if (!correct) {
    return {
      box: 1,
      due: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000).toISOString(),
      reviews: prev.reviews + 1,
      lapses: prev.lapses + 1,
      lastReviewed: now.toISOString(),
    }
  }
  // A brand-new card answered correctly starts in box 2; otherwise move up one box.
  const box = Math.min(card ? prev.box + 1 : 2, 5)
  return {
    box,
    due: new Date(now.getTime() + INTERVAL_DAYS[box] * DAY).toISOString(),
    reviews: prev.reviews + 1,
    lapses: prev.lapses,
    lastReviewed: now.toISOString(),
  }
}

export const isDue = (card: CardState, now: Date): boolean => Date.parse(card.due) <= now.getTime()

/** Number of items falling due on each of the next `days` local days (index 0 = today, includes overdue). */
export function dueForecast(cards: CardState[], now: Date, days = 7): number[] {
  const counts = new Array(days).fill(0)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  for (const c of cards) {
    const offset = Math.floor((Date.parse(c.due) - startOfToday) / DAY)
    if (offset < days) counts[Math.max(0, offset)] += 1
  }
  return counts
}
