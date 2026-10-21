import { BarChart3, CalendarCheck2, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/AppShell'
import { FlashcardDeck } from '../components/FlashcardDeck'
import { QuizRunner } from '../components/QuizRunner'
import { Button, Card, EmptyState, ProgressBar, SectionTitle, Tabs, cx } from '../components/ui'
import { contentIndex, flashcards, getQuestion, modules, questions, questionsOfModule } from '../content'
import type { Flashcard, Question } from '../content/types'
import { INTERVAL_DAYS } from '../lib/progress/leitner'
import { dueItems, moduleAccuracy, wrongQuestions } from '../lib/progress/selectors'
import { useProgress } from '../lib/progress/store'
import { seededShuffle } from '../lib/quiz/grade'

type Tab = 'due' | 'cards' | 'module' | 'mixed' | 'wrong' | 'stats'

export function ReviewPage() {
  const progress = useProgress((p) => p)
  const [tab, setTab] = useState<Tab>('due')
  // Snapshot the due queue when the page opens so answering does not reshuffle the session.
  const [sessionAt, setSessionAt] = useState(() => new Date())
  const due = useMemo(() => dueItems(progress, contentIndex, sessionAt), [progress, sessionAt])
  const [dueSnapshot, setDueSnapshot] = useState(due)
  const wrong = useMemo(() => wrongQuestions(progress, contentIndex), [progress])

  const dueCards = dueSnapshot
    .filter((i) => i.kind === 'flashcard')
    .map((i) => flashcards.find((f) => `f:${f.id}` === i.id))
    .filter((f): f is Flashcard => !!f)
  const dueQuestions = dueSnapshot
    .filter((i) => i.kind === 'question')
    .map((i) => getQuestion(i.id.slice(2)))
    .filter((q): q is Question => !!q)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Ôn tập"
        description="Spaced repetition theo hệ Leitner 5 hộp: nhớ → lên hộp, khoảng cách ôn tăng dần (1, 2, 4, 8, 16 ngày); quên → về hộp 1, ôn lại sau 10 phút."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { id: 'due', label: 'Đến hạn', count: due.length },
          { id: 'cards', label: 'Flashcards', count: flashcards.length },
          { id: 'module', label: 'Quiz theo module' },
          { id: 'mixed', label: 'Quiz tổng hợp' },
          { id: 'wrong', label: 'Câu đã sai', count: wrong.length },
          { id: 'stats', label: 'Thống kê' },
        ]}
      />

      {tab === 'due' && (
        <div className="space-y-6">
          {due.length !== dueSnapshot.length && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13.5px]">
              <span className="text-muted">Hàng đợi đã thay đổi ({due.length} mục đến hạn).</span>
              <Button
                size="sm"
                onClick={() => {
                  const now = new Date()
                  setSessionAt(now)
                  setDueSnapshot(dueItems(progress, contentIndex, now))
                }}
              >
                Làm mới phiên ôn
              </Button>
            </div>
          )}
          {dueSnapshot.length === 0 ? (
            <EmptyState icon={<CalendarCheck2 />} title="Không có mục nào đến hạn">
              Flashcard của các bài bạn đã mở và câu quiz trả lời sai sẽ xuất hiện ở đây đúng ngày cần ôn.
            </EmptyState>
          ) : (
            <>
              {dueCards.length > 0 && (
                <Card className="p-5">
                  <SectionTitle>Flashcard đến hạn ({dueCards.length})</SectionTitle>
                  <FlashcardDeck cards={dueCards} showLessonLink />
                </Card>
              )}
              {dueQuestions.length > 0 && (
                <Card className="p-5">
                  <SectionTitle>Câu hỏi cần làm lại ({dueQuestions.length})</SectionTitle>
                  <QuizRunner questions={dueQuestions} showLessonLink />
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'cards' && <AllCards />}
      {tab === 'module' && <ModuleQuiz />}
      {tab === 'mixed' && <MixedQuiz />}
      {tab === 'wrong' && (
        <Card className="p-5">
          <QuizRunner
            questions={wrong}
            showLessonLink
            emptyText="Chưa có câu nào trả lời sai (tính theo lần trả lời gần nhất)."
          />
        </Card>
      )}
      {tab === 'stats' && <Stats />}
    </div>
  )
}

function ModulePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {modules.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={value === m.id}
          onClick={() => onChange(m.id)}
          className={cx(
            'h-8 rounded-full border px-3 text-[13px] font-medium',
            value === m.id ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg',
          )}
        >
          {m.index}. {m.shortTitle}
        </button>
      ))}
    </div>
  )
}

function AllCards() {
  const [moduleId, setModuleId] = useState('m1')
  const lessonIds = new Set(contentIndex.lessons.filter((l) => l.moduleId === moduleId).map((l) => l.id))
  return (
    <Card className="p-5">
      <ModulePicker value={moduleId} onChange={setModuleId} />
      <FlashcardDeck
        cards={flashcards.filter((f) => lessonIds.has(f.lessonId))}
        showLessonLink
        emptyText="Module này chưa có flashcard."
      />
    </Card>
  )
}

function ModuleQuiz() {
  const [moduleId, setModuleId] = useState('m1')
  return (
    <Card className="p-5">
      <ModulePicker value={moduleId} onChange={setModuleId} />
      <QuizRunner
        questions={questionsOfModule(moduleId)}
        showLessonLink
        emptyText="Module này chưa có câu hỏi."
      />
    </Card>
  )
}

function MixedQuiz() {
  const [seed, setSeed] = useState(() => String(Date.now()))
  const picked = useMemo(() => seededShuffle(questions, seed).slice(0, 20), [seed])
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">
          20 câu ngẫu nhiên từ toàn bộ ngân hàng {questions.length} câu của khóa học.
        </p>
        <Button size="sm" onClick={() => setSeed(String(Date.now()))}>
          <Shuffle className="size-3.5" /> Tạo đề mới
        </Button>
      </div>
      <QuizRunner questions={picked} showLessonLink />
    </Card>
  )
}

function Stats() {
  const progress = useProgress((p) => p)
  const rows = useMemo(() => moduleAccuracy(progress, contentIndex), [progress])
  const boxes = [1, 2, 3, 4, 5].map((b) => Object.values(progress.cards).filter((c) => c.box === b).length)
  const anyAnswered = rows.some((r) => r.accuracy.answered > 0)
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle>Độ chính xác theo module</SectionTitle>
        {anyAnswered ? (
          <ul className="space-y-3">
            {rows.map(({ module: m, accuracy: a }) => (
              <li key={m.id}>
                <div className="mb-1 flex justify-between text-[13.5px]">
                  <span>
                    {m.index}. {m.shortTitle}
                  </span>
                  <span className="tabular-nums text-muted">
                    {a.rate === null
                      ? 'chưa làm'
                      : `${Math.round(a.rate * 100)}% · ${a.correct}/${a.answered}`}
                    <span className="text-subtle"> / {questionsOfModule(m.id).length} câu</span>
                  </span>
                </div>
                <ProgressBar
                  value={a.rate === null ? 0 : a.rate * 100}
                  tone={
                    a.rate === null
                      ? 'accent'
                      : a.rate >= 0.8
                        ? 'success'
                        : a.rate >= 0.6
                          ? 'warning'
                          : 'danger'
                  }
                  label={`Độ chính xác ${m.shortTitle}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<BarChart3 />} title="Chưa có dữ liệu" className="py-6">
            Làm quiz ở bất kỳ bài nào để thấy thống kê.
          </EmptyState>
        )}
      </Card>
      <Card className="p-5">
        <SectionTitle>Phân bố hộp Leitner</SectionTitle>
        <div className="space-y-2.5">
          {boxes.map((n, i) => (
            <div key={i} className="flex items-center gap-3 text-[13.5px]">
              <span className="w-28 shrink-0 text-muted">
                Hộp {i + 1} <span className="text-subtle">({INTERVAL_DAYS[i + 1]} ngày)</span>
              </span>
              <ProgressBar value={n} max={Math.max(1, ...boxes)} className="flex-1" label={`Hộp ${i + 1}`} />
              <span className="w-8 text-right tabular-nums">{n}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-subtle">
          Tổng {Object.keys(progress.cards).length} mục đang được lên lịch ôn.
        </p>
      </Card>
    </div>
  )
}
