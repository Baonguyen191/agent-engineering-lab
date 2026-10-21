import { Check, Layers, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { getLesson } from '../content'
import type { Flashcard } from '../content/types'
import { reviewItem } from '../lib/progress/store'
import { InlineMarkdown } from './Markdown'
import { Button, EmptyState, ProgressBar } from './ui'

/**
 * Flip-card review. "Đã nhớ" / "Chưa nhớ" update the card's Leitner box (spaced repetition).
 */
export function FlashcardDeck({
  cards,
  showLessonLink = false,
  emptyText = 'Không có thẻ nào.',
}: {
  cards: Flashcard[]
  showLessonLink?: boolean
  emptyText?: string
}) {
  const [deck, setDeck] = useState(cards)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<{ card: Flashcard; ok: boolean }[]>([])

  const signature = cards.map((c) => c.id).join('|')
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setDeck(cards)
    setIndex(0)
    setFlipped(false)
    setResults([])
  }

  if (!deck.length) return <EmptyState icon={<Layers />} title={emptyText} />

  if (index >= deck.length) {
    const missed = results.filter((r) => !r.ok).map((r) => r.card)
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-line bg-surface-2 p-5">
          <div className="text-[13px] text-muted">Đã ôn {results.length} thẻ</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {results.length - missed.length} nhớ · {missed.length} chưa nhớ
          </div>
          <p className="mt-2 text-sm text-muted">Lịch ôn của từng thẻ đã được cập nhật theo hệ Leitner.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {missed.length > 0 && (
            <Button
              variant="primary"
              onClick={() => {
                setDeck(missed)
                setIndex(0)
                setResults([])
                setFlipped(false)
              }}
            >
              <RotateCcw className="size-4" /> Ôn lại {missed.length} thẻ chưa nhớ
            </Button>
          )}
          <Button
            onClick={() => {
              setDeck(cards)
              setIndex(0)
              setResults([])
              setFlipped(false)
            }}
          >
            Ôn lại từ đầu
          </Button>
        </div>
      </div>
    )
  }

  const card = deck[index]
  const lesson = showLessonLink ? getLesson(card.lessonId) : undefined
  const answer = (ok: boolean) => {
    reviewItem(`f:${card.id}`, ok)
    setResults((r) => [...r, { card, ok }])
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[12.5px] tabular-nums text-muted">
          Thẻ {index + 1}/{deck.length}
        </span>
        <ProgressBar value={index} max={deck.length} className="flex-1" label="Tiến độ ôn thẻ" />
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Xem mặt trước' : 'Lật thẻ để xem đáp án'}
        className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-line bg-surface-2 px-5 py-6 text-center transition-colors hover:border-line-strong"
      >
        <span className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-subtle">
          {flipped ? 'Mặt sau' : 'Mặt trước — bấm để lật'}
        </span>
        <span
          className={flipped ? 'text-[14.5px] leading-relaxed' : 'text-[16px] font-medium leading-relaxed'}
        >
          <InlineMarkdown text={flipped ? card.back : card.front} />
        </span>
      </button>
      {lesson && (
        <Link
          to={`/learn/${lesson.id}`}
          className="mt-2 inline-block text-[12.5px] text-muted hover:text-accent"
        >
          Bài: {lesson.title.replace(/`/g, '')}
        </Link>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => answer(false)} disabled={!flipped}>
          <X className="size-4 text-danger" /> Chưa nhớ
        </Button>
        <Button variant="primary" onClick={() => answer(true)} disabled={!flipped}>
          <Check className="size-4" /> Đã nhớ
        </Button>
      </div>
      {!flipped && (
        <p className="mt-2 text-center text-xs text-subtle">Tự trả lời trong đầu, lật thẻ rồi tự chấm.</p>
      )}
    </div>
  )
}
