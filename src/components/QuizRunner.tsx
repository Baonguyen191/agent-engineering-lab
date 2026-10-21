import { ArrowDown, ArrowUp, BookOpen, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getLesson } from '../content'
import type { Question, QuestionKind } from '../content/types'
import { recordQuizAnswer } from '../lib/progress/store'
import { grade, seededShuffle, type GradeResult, type QuizResponse } from '../lib/quiz/grade'
import { CodeBlock, InlineMarkdown } from './Markdown'
import { Badge, Button, EmptyState, ProgressBar, cx } from './ui'

const KIND_LABEL: Record<QuestionKind, string> = {
  concept: 'Khái niệm',
  'predict-output': 'Dự đoán kết quả',
  'find-bug': 'Tìm lỗi',
  architecture: 'Chọn kiến trúc',
  'system-design': 'Thiết kế hệ thống',
  terminology: 'Thuật ngữ',
  ordering: 'Sắp xếp',
}

interface Answered {
  question: Question
  correct: boolean
}

export function QuizRunner({
  questions,
  showLessonLink = false,
  emptyText = 'Chưa có câu hỏi cho phần này.',
}: {
  questions: Question[]
  showLessonLink?: boolean
  emptyText?: string
}) {
  const [round, setRound] = useState<Question[]>(questions)
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<Answered[]>([])
  const [roundKey, setRoundKey] = useState(0)

  // Reset when the question set changes (e.g. navigating to another lesson).
  const signature = questions.map((q) => q.id).join('|')
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setRound(questions)
    setIndex(0)
    setAnswered([])
  }

  if (!round.length) return <EmptyState title={emptyText} />

  if (index >= round.length) {
    const correct = answered.filter((a) => a.correct).length
    const wrong = answered.filter((a) => !a.correct).map((a) => a.question)
    const pct = Math.round((correct / answered.length) * 100)
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2 p-5 text-center">
          <div className="text-[13px] text-muted">Kết quả</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {correct}/{answered.length}
          </div>
          <ProgressBar
            value={pct}
            tone={pct >= 70 ? 'success' : 'warning'}
            className="mx-auto mt-3 max-w-48"
            label="Tỷ lệ đúng"
          />
          <p className="mt-3 text-sm text-muted">
            {pct >= 70
              ? 'Tốt! Các câu sai đã được thêm vào lịch ôn tập.'
              : 'Nên đọc lại bài trước khi tiếp tục. Câu sai đã được đưa vào lịch ôn tập.'}
          </p>
        </div>
        {wrong.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted">Câu cần xem lại</div>
            <ul className="space-y-1.5">
              {wrong.map((q) => (
                <li key={q.id} className="rounded-lg border border-line px-3 py-2 text-[13.5px]">
                  <InlineMarkdown text={q.prompt} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {wrong.length > 0 && (
            <Button
              variant="primary"
              onClick={() => {
                setRound(wrong)
                setIndex(0)
                setAnswered([])
                setRoundKey((k) => k + 1)
              }}
            >
              <RotateCcw className="size-4" /> Làm lại {wrong.length} câu sai
            </Button>
          )}
          <Button
            onClick={() => {
              setRound(questions)
              setIndex(0)
              setAnswered([])
              setRoundKey((k) => k + 1)
            }}
          >
            Làm lại toàn bộ
          </Button>
        </div>
      </div>
    )
  }

  const q = round[index]
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[12.5px] tabular-nums text-muted">
          Câu {index + 1}/{round.length}
        </span>
        <ProgressBar value={index} max={round.length} className="flex-1" label="Tiến độ quiz" />
      </div>
      <QuestionCard
        key={`${roundKey}-${q.id}`}
        question={q}
        showLessonLink={showLessonLink}
        onAnswered={(correct) => setAnswered((a) => [...a, { question: q, correct }])}
        onNext={() => setIndex((i) => i + 1)}
        isLast={index === round.length - 1}
      />
    </div>
  )
}

function QuestionCard({
  question: q,
  showLessonLink,
  onAnswered,
  onNext,
  isLast,
}: {
  question: Question
  showLessonLink: boolean
  onAnswered: (correct: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const [single, setSingle] = useState<number | null>(null)
  const [multi, setMulti] = useState<number[]>([])
  const [tf, setTf] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  const initialOrder = useMemo(
    () =>
      q.type === 'order'
        ? seededShuffle(
            q.items.map((_, i) => i),
            q.id,
          )
        : [],
    [q],
  )
  const [order, setOrder] = useState<number[]>(initialOrder)
  const [result, setResult] = useState<GradeResult | null>(null)

  const response: QuizResponse | null =
    q.type === 'single'
      ? single === null
        ? null
        : { type: 'single', choice: single }
      : q.type === 'multi'
        ? multi.length
          ? { type: 'multi', choices: multi }
          : null
        : q.type === 'truefalse'
          ? tf === null
            ? null
            : { type: 'truefalse', value: tf }
          : q.type === 'fill'
            ? text.trim()
              ? { type: 'fill', text }
              : null
            : { type: 'order', order }

  const submit = () => {
    if (!response || result) return
    const r = grade(q, response)
    setResult(r)
    recordQuizAnswer(q.id, q.lessonId, r.correct)
    onAnswered(r.correct)
  }

  const lesson = getLesson(q.lessonId)
  const locked = result !== null

  const optionClass = (i: number, selected: boolean) => {
    if (!locked)
      return selected
        ? 'border-accent bg-accent-soft'
        : 'border-line hover:border-line-strong hover:bg-surface-2'
    const isAnswer = q.type === 'single' ? q.answer === i : q.type === 'multi' ? q.answer.includes(i) : false
    if (isAnswer) return 'border-success/60 bg-success-soft'
    if (selected) return 'border-danger/60 bg-danger-soft'
    return 'border-line opacity-70'
  }

  const chosenWrong: { i: number; text: string }[] =
    result && !result.correct && (q.type === 'single' || q.type === 'multi') && q.whyNot
      ? (q.type === 'single' ? [single ?? -1] : multi)
          .map((i) => ({ i, text: q.whyNot?.[i] ?? '' }))
          .filter((x) => x.text)
      : []

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{KIND_LABEL[q.kind]}</Badge>
        {q.type === 'multi' && <Badge>Chọn nhiều đáp án</Badge>}
        {showLessonLink && lesson && <Badge>{lesson.title.replace(/`/g, '')}</Badge>}
      </div>
      <p className="text-[15px] font-medium leading-relaxed">
        <InlineMarkdown text={q.prompt} />
      </p>
      {q.code && <CodeBlock code={q.code} lang="python" className="my-3" />}

      <div className="mt-3 space-y-2">
        {(q.type === 'single' || q.type === 'multi') &&
          q.options.map((opt, i) => {
            const selected = q.type === 'single' ? single === i : multi.includes(i)
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                aria-pressed={selected}
                onClick={() =>
                  q.type === 'single'
                    ? setSingle(i)
                    : setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))
                }
                className={cx(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-[14px] transition-colors',
                  optionClass(i, selected),
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 grid size-5 shrink-0 place-items-center border text-[11px] font-semibold',
                    q.type === 'single' ? 'rounded-full' : 'rounded',
                    selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-muted',
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">
                  <InlineMarkdown text={opt} />
                </span>
              </button>
            )
          })}

        {q.type === 'truefalse' && (
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                disabled={locked}
                aria-pressed={tf === v}
                onClick={() => setTf(v)}
                className={cx(
                  'rounded-lg border px-3 py-2.5 text-[14px] font-medium transition-colors',
                  !locked
                    ? tf === v
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:bg-surface-2'
                    : q.answer === v
                      ? 'border-success/60 bg-success-soft'
                      : tf === v
                        ? 'border-danger/60 bg-danger-soft'
                        : 'border-line opacity-70',
                )}
              >
                {v ? 'Đúng' : 'Sai'}
              </button>
            ))}
          </div>
        )}

        {q.type === 'fill' && (
          <input
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={q.placeholder ?? 'Nhập câu trả lời…'}
            aria-label="Câu trả lời"
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 font-mono text-[14px] outline-none focus:border-accent"
          />
        )}

        {q.type === 'order' && (
          <ol className="space-y-1.5">
            {order.map((itemIdx, pos) => (
              <li
                key={itemIdx}
                className={cx(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[14px]',
                  locked
                    ? itemIdx === pos
                      ? 'border-success/60 bg-success-soft'
                      : 'border-danger/60 bg-danger-soft'
                    : 'border-line',
                )}
              >
                <span className="w-5 text-center text-[12px] tabular-nums text-subtle">{pos + 1}</span>
                <span className="min-w-0 flex-1">
                  <InlineMarkdown text={q.items[itemIdx]} />
                </span>
                {!locked && (
                  <span className="flex gap-0.5">
                    <button
                      type="button"
                      aria-label="Lên"
                      disabled={pos === 0}
                      onClick={() => setOrder((o) => swap(o, pos, pos - 1))}
                      className="grid size-7 place-items-center rounded text-muted hover:bg-surface-2 disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Xuống"
                      disabled={pos === order.length - 1}
                      onClick={() => setOrder((o) => swap(o, pos, pos + 1))}
                      className="grid size-7 place-items-center rounded text-muted hover:bg-surface-2 disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {result && (
        <div
          role="status"
          className={cx(
            'mt-4 rounded-xl border p-4 text-[14px]',
            result.correct ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft',
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result.correct ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <XCircle className="size-4 text-danger" />
            )}
            {result.correct ? 'Chính xác' : 'Chưa đúng'}
          </div>
          {!result.correct && (
            <div className="mt-2 whitespace-pre-line">
              <span className="text-muted">Đáp án: </span>
              <InlineMarkdown text={result.expected} />
            </div>
          )}
          <p className="mt-2 text-fg/90">
            <InlineMarkdown text={q.explanation} />
          </p>
          {chosenWrong.map(({ i, text }) => (
            <p key={i} className="mt-2 text-[13.5px] text-muted">
              Vì sao không phải {String.fromCharCode(65 + i)}: <InlineMarkdown text={text} />
            </p>
          ))}
          {!result.correct && lesson && (
            <Link
              to={`/learn/${lesson.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
            >
              <BookOpen className="size-3.5" /> Ôn lại: {lesson.title.replace(/`/g, '')}
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {!result ? (
          <Button variant="primary" onClick={submit} disabled={!response}>
            Kiểm tra
          </Button>
        ) : (
          <Button variant="primary" onClick={onNext}>
            {isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
          </Button>
        )}
      </div>
    </div>
  )
}

function swap(arr: number[], a: number, b: number): number[] {
  const out = [...arr]
  ;[out[a], out[b]] = [out[b], out[a]]
  return out
}
