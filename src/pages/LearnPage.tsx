import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Code2,
  ExternalLink,
  FileText,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  StepForward,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FlashcardDeck } from '../components/FlashcardDeck'
import { Markdown } from '../components/Markdown'
import { QuizRunner } from '../components/QuizRunner'
import { YouTubePlayer, type PlayerHandle } from '../components/YouTubePlayer'
import { Badge, Button, IconButton, Notice, StatusIcon, Tabs, cx } from '../components/ui'
import { VIDEO } from '../content/course'
import {
  adjacentLessons,
  flashcardsOfLesson,
  getExercise,
  getLesson,
  getModule,
  lessonsOfModule,
  modules,
  questionsOfLesson,
} from '../content'
import type { Lesson } from '../content/types'
import { formatDuration, formatTimestamp } from '../lib/format'
import {
  addBookmark,
  openLesson,
  recordVideoProgress,
  removeBookmark,
  setLessonCompleted,
  setNotes,
  toggleChecklist,
  useProgress,
} from '../lib/progress/store'
import { emptyLessonProgress } from '../lib/progress/schema'
import { youtubeUrlAt } from '../lib/youtube'
import { NotFoundPage } from './NotFoundPage'

const plain = (s: string) => s.replace(/`/g, '')

export function LearnPage() {
  const { lessonId = '' } = useParams()
  const lesson = getLesson(lessonId)
  if (!lesson) return <NotFoundPage what="Bài học" />
  return <LearnWorkspace key={lesson.id} lesson={lesson} />
}

type PracticeTab = 'quiz' | 'cards' | 'lab' | 'checklist' | 'notes'

function LearnWorkspace({ lesson }: { lesson: Lesson }) {
  const module = getModule(lesson.moduleId)!
  const lp = useProgress((p) => p.lessons[lesson.id]) ?? emptyLessonProgress()
  const player = useRef<PlayerHandle>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [mobileView, setMobileView] = useState<'lesson' | 'practice'>('lesson')
  const [tab, setTab] = useState<PracticeTab>('quiz')
  const { prev, next } = adjacentLessons(lesson.id)
  const questions = questionsOfLesson(lesson.id)
  const cards = flashcardsOfLesson(lesson.id)

  useEffect(() => {
    openLesson(lesson.id)
    window.scrollTo(0, 0)
  }, [lesson.id])

  const seek = (t: number) => {
    setMobileView('lesson')
    player.current?.seekTo(t)
    document.getElementById('lesson-video')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const v = lesson.video
  const canResume =
    v && lp.lastPosition !== undefined && lp.lastPosition > v.start + 15 && lp.lastPosition < v.end
  const checklistDone = lesson.checklist.filter((_, i) => lp.checklist[i]).length

  const practice = (
    <PracticePanel
      lesson={lesson}
      tab={tab}
      setTab={setTab}
      questionsCount={questions.length}
      cardsCount={cards.length}
      checklistDone={checklistDone}
      onSeek={seek}
    />
  )

  return (
    <div className="flex min-h-full">
      {/* Curriculum sidebar (xl+) */}
      <aside
        className={cx(
          'sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-line bg-surface min-[1800px]:block',
          sidebarOpen ? 'w-72' : 'w-0 border-r-0',
        )}
        aria-label="Mục lục khóa học"
      >
        {sidebarOpen && <Curriculum currentId={lesson.id} onClose={() => setSidebarOpen(false)} />}
      </aside>

      {/* Curriculum drawer (< xl) */}
      {drawer && (
        <div
          className="fixed inset-0 z-40 min-[1800px]:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mục lục khóa học"
        >
          <button
            type="button"
            aria-label="Đóng mục lục"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)] overflow-y-auto border-r border-line bg-surface">
            <Curriculum
              currentId={lesson.id}
              onClose={() => setDrawer(false)}
              onNavigate={() => setDrawer(false)}
            />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="sticky top-14 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur sm:px-4 lg:top-0">
          <IconButton label="Mở mục lục" className="min-[1800px]:hidden" onClick={() => setDrawer(true)}>
            <ListTree className="size-4" />
          </IconButton>
          {!sidebarOpen && (
            <IconButton
              label="Hiện mục lục"
              className="hidden min-[1800px]:inline-flex"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen className="size-4" />
            </IconButton>
          )}
          <div className="min-w-0 flex-1 truncate text-[13px] text-muted">
            <Link to={`/course#${module.id}`} className="hover:text-fg">
              Module {module.index} · {module.shortTitle}
            </Link>
            <span className="px-1.5 text-subtle">/</span>
            <span className="text-fg">{plain(lesson.title)}</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { l: prev, label: 'Bài trước', Icon: ChevronLeft },
              { l: next, label: 'Bài tiếp theo', Icon: ChevronRight },
            ].map(({ l, label, Icon }) =>
              l ? (
                <Link
                  key={label}
                  to={`/learn/${l.id}`}
                  aria-label={`${label}: ${plain(l.title)}`}
                  title={`${label}: ${plain(l.title)}`}
                  className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <Icon className="size-4" />
                </Link>
              ) : (
                <span
                  key={label}
                  className="grid size-8 place-items-center text-subtle opacity-40"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
              ),
            )}
          </div>
        </div>

        {/* Mobile/tablet view switch */}
        <div className="border-b border-line px-3 py-2 lg:hidden">
          <Tabs
            value={mobileView}
            onChange={setMobileView}
            tabs={[
              { id: 'lesson', label: 'Bài học' },
              { id: 'practice', label: 'Luyện tập', count: questions.length + cards.length },
            ]}
          />
        </div>

        <div className="flex">
          <article
            className={cx(
              'min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8',
              mobileView === 'practice' && 'hidden lg:block',
            )}
          >
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusIcon status={lp.status} />
                <Badge tone={lesson.source === 'video' ? 'accent' : 'neutral'}>
                  {lesson.source === 'video' ? 'Theo video' : 'Tài liệu bổ sung'}
                </Badge>
                {v && (
                  <Badge>
                    {formatTimestamp(v.start)}–{formatTimestamp(v.end)} · {formatDuration(v.end - v.start)}
                  </Badge>
                )}
                <Badge>~{lesson.studyMinutes} phút đọc & luyện</Badge>
              </div>
              <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
                {plain(lesson.title)}
              </h1>
              <p className="mt-2 text-[15px] text-muted">{plain(lesson.summary)}</p>

              <div id="lesson-video" className="mt-5 scroll-mt-28">
                {v ? (
                  <>
                    <YouTubePlayer
                      ref={player}
                      videoId={VIDEO.id}
                      start={v.start}
                      onProgress={(pos, delta) => {
                        if (pos >= v.start - 30 && pos <= v.end + 30)
                          recordVideoProgress(lesson.id, pos, delta)
                      }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => seek(v.start)}>
                        <RotateCcw className="size-3.5" /> Đầu bài ({formatTimestamp(v.start)})
                      </Button>
                      {canResume && (
                        <Button size="sm" variant="primary" onClick={() => seek(lp.lastPosition!)}>
                          <StepForward className="size-3.5" /> Tiếp tục từ {formatTimestamp(lp.lastPosition!)}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          const t = player.current?.getCurrentTime()
                          if (t != null) {
                            addBookmark(lesson.id, t, '')
                            setTab('notes')
                          }
                        }}
                      >
                        <Bookmark className="size-3.5" /> Đánh dấu thời điểm
                      </Button>
                      <a
                        href={youtubeUrlAt(VIDEO.id, v.start)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted hover:text-fg"
                      >
                        Mở trên YouTube <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    <p className="mt-2 text-[12px] text-subtle">
                      {v.precision === 'transcript'
                        ? 'Mốc thời gian của bài được xác định từ transcript tự động của YouTube, có thể lệch khoảng ±1 phút.'
                        : 'Mốc thời gian lấy từ mô tả chính thức của video.'}{' '}
                      Đoạn đã xem trong app: {formatDuration(lp.watchedSeconds)}.
                    </p>
                  </>
                ) : (
                  <Notice>
                    <FileText className="mr-1.5 inline size-4" />
                    Bài bổ sung do ứng dụng biên soạn để lấp khoảng trống trong lộ trình; nội dung này không
                    có (hoặc chỉ được nhắc qua) trong video.
                  </Notice>
                )}
              </div>

              <section className="mt-6 rounded-xl border border-line bg-surface p-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">
                  Mục tiêu bài học
                </h2>
                <ul className="mt-2 space-y-1.5 text-[14px]">
                  {lesson.objectives.map((o) => (
                    <li key={o} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                      <Markdown className="max-w-none [&>p]:m-0">{o}</Markdown>
                    </li>
                  ))}
                </ul>
              </section>

              <Markdown className="mt-6" onSeek={v ? seek : undefined}>
                {lesson.body}
              </Markdown>

              {lesson.references.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">
                    Tài liệu tham khảo
                  </h2>
                  <ul className="mt-2 space-y-1 text-[14px]">
                    {lesson.references.map((r) => (
                      <li key={r.url}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          {r.label} <ExternalLink className="size-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-10 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-[14px]">
                  {lp.status === 'completed' ? (
                    <span className="inline-flex items-center gap-2 font-medium text-success">
                      <CheckCircle2 className="size-4" /> Đã hoàn thành bài này
                    </span>
                  ) : (
                    <span className="text-muted">
                      Xong phần video và bài đọc? Làm quiz rồi đánh dấu hoàn thành ({checklistDone}/
                      {lesson.checklist.length} mục checklist).
                    </span>
                  )}
                </div>
                <Button
                  variant={lp.status === 'completed' ? 'secondary' : 'primary'}
                  onClick={() => setLessonCompleted(lesson.id, lp.status !== 'completed')}
                >
                  {lp.status === 'completed' ? (
                    <>
                      <Circle className="size-4" /> Bỏ đánh dấu
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" /> Đánh dấu hoàn thành
                    </>
                  )}
                </Button>
              </div>

              <nav className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Chuyển bài">
                {prev ? (
                  <Link
                    to={`/learn/${prev.id}`}
                    className="rounded-xl border border-line p-3 hover:border-line-strong hover:bg-surface"
                  >
                    <div className="text-[12px] text-subtle">← Bài trước</div>
                    <div className="truncate text-[14px] font-medium">{plain(prev.title)}</div>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link
                    to={`/learn/${next.id}`}
                    className="rounded-xl border border-line p-3 text-right hover:border-line-strong hover:bg-surface"
                  >
                    <div className="text-[12px] text-subtle">Bài tiếp theo →</div>
                    <div className="truncate text-[14px] font-medium">{plain(next.title)}</div>
                  </Link>
                )}
              </nav>
            </div>
          </article>

          {/* Practice panel */}
          <aside
            className={cx(
              'w-full shrink-0 border-line lg:sticky lg:top-12 lg:block lg:h-[calc(100vh-3rem)] lg:w-[380px] lg:overflow-y-auto lg:border-l 2xl:w-[420px]',
              mobileView === 'lesson' && 'hidden',
            )}
            aria-label="Luyện tập"
          >
            {practice}
          </aside>
        </div>
      </div>
    </div>
  )
}

function PracticePanel({
  lesson,
  tab,
  setTab,
  questionsCount,
  cardsCount,
  checklistDone,
  onSeek,
}: {
  lesson: Lesson
  tab: PracticeTab
  setTab: (t: PracticeTab) => void
  questionsCount: number
  cardsCount: number
  checklistDone: number
  onSeek: (t: number) => void
}) {
  const lp = useProgress((p) => p.lessons[lesson.id]) ?? emptyLessonProgress()
  const lab = useProgress((p) => p.lab)
  return (
    <div className="p-4">
      <Tabs
        size="sm"
        value={tab}
        onChange={setTab}
        className="-mx-1 mb-4 px-1"
        tabs={[
          { id: 'quiz', label: 'Quiz', count: questionsCount },
          { id: 'cards', label: 'Flashcard', count: cardsCount },
          { id: 'lab', label: 'Lab', count: lesson.exercises?.length ?? 0 },
          { id: 'checklist', label: 'Checklist', count: checklistDone },
          { id: 'notes', label: 'Ghi chú' },
        ]}
      />
      {tab === 'quiz' && (
        <QuizRunner questions={questionsOfLesson(lesson.id)} emptyText="Bài này chưa có câu hỏi." />
      )}
      {tab === 'cards' && (
        <FlashcardDeck cards={flashcardsOfLesson(lesson.id)} emptyText="Bài này chưa có flashcard." />
      )}
      {tab === 'lab' &&
        (lesson.exercises?.length ? (
          <ul className="space-y-2">
            {lesson.exercises.map((id) => {
              const ex = getExercise(id)
              if (!ex) return null
              const st = lab[id]
              return (
                <li key={id}>
                  <Link
                    to={`/lab/${id}`}
                    className="block rounded-xl border border-line p-3 hover:border-line-strong hover:bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="size-4 text-accent" />
                      <span className="min-w-0 flex-1 text-[14px] font-medium">{ex.title}</span>
                      {st?.passed ? (
                        <Badge tone="success">Đạt</Badge>
                      ) : st?.attempts ? (
                        <Badge tone="warning">
                          {st.bestPassed}/{st.total} test
                        </Badge>
                      ) : (
                        <Badge>Chưa làm</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted">
                      Mở trong Coding Lab — editor, chạy Python thật và chấm bằng test.
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">
            Bài này không có bài lab riêng. Xem toàn bộ bài tập ở{' '}
            <Link to="/lab" className="text-accent hover:underline">
              Coding Lab
            </Link>
            .
          </p>
        ))}
      {tab === 'checklist' && (
        <div>
          <p className="mb-3 text-[13px] text-muted">
            Tự đánh giá: tích khi bạn làm/giải thích được mà không cần xem lại.
          </p>
          <ul className="space-y-1.5">
            {lesson.checklist.map((item, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-[13.5px] hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={!!lp.checklist[i]}
                    onChange={() => toggleChecklist(lesson.id, i)}
                    className="mt-0.5 size-4 accent-[var(--accent-strong)]"
                  />
                  <Markdown className="max-w-none [&>p]:m-0">{item}</Markdown>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === 'notes' && <NotesPanel lessonId={lesson.id} onSeek={onSeek} />}
    </div>
  )
}

function NotesPanel({ lessonId, onSeek }: { lessonId: string; onSeek: (t: number) => void }) {
  const lp = useProgress((p) => p.lessons[lessonId]) ?? emptyLessonProgress()
  const [draft, setDraft] = useState(lp.notes)
  const [saved, setSaved] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="lesson-notes" className="text-[13px] font-medium">
            Ghi chú cá nhân (Markdown)
          </label>
          <span className="text-[12px] text-subtle">{saved ? 'Đã lưu' : 'Đang lưu…'}</span>
        </div>
        <textarea
          id="lesson-notes"
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            setDraft(v)
            setSaved(false)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => {
              setNotes(lessonId, v)
              setSaved(true)
            }, 500)
          }}
          rows={10}
          placeholder="Điều quan trọng nhất mình rút ra từ bài này là…"
          className="w-full resize-y rounded-lg border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent"
        />
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-medium">Mốc video đã đánh dấu</div>
        {lp.bookmarks.length ? (
          <ul className="space-y-1.5">
            {lp.bookmarks.map((b, i) => (
              <li
                key={`${b.t}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onSeek(b.t)}
                  className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[12px] text-accent hover:underline"
                >
                  {formatTimestamp(b.t)}
                </button>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                  {b.label || 'Không có nhãn'}
                </span>
                <IconButton label="Xóa mốc" onClick={() => removeBookmark(lessonId, i)}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-subtle">
            Bấm “Đánh dấu thời điểm” dưới video để lưu mốc cần xem lại.
          </p>
        )}
      </div>
    </div>
  )
}

function Curriculum({
  currentId,
  onClose,
  onNavigate,
}: {
  currentId: string
  onClose: () => void
  onNavigate?: () => void
}) {
  const current = getLesson(currentId)
  const [open, setOpen] = useState<Set<string>>(() => new Set([current?.moduleId ?? 'm1']))
  const statuses = useProgress((p) => p.lessons)
  return (
    <div className="py-3">
      <div className="flex items-center justify-between px-4 pb-2">
        <Link to="/course" className="text-[13px] font-semibold hover:text-accent" onClick={onNavigate}>
          Mục lục khóa học
        </Link>
        <IconButton label="Đóng mục lục" onClick={onClose}>
          <span className="hidden min-[1800px]:inline">
            <PanelLeftClose className="size-4" />
          </span>
          <span className="min-[1800px]:hidden">
            <X className="size-4" />
          </span>
        </IconButton>
      </div>
      {modules.map((m) => {
        const ls = lessonsOfModule(m.id)
        const done = ls.filter((l) => statuses[l.id]?.status === 'completed').length
        const isOpen = open.has(m.id)
        return (
          <div key={m.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((s) => {
                  const n = new Set(s)
                  if (n.has(m.id)) n.delete(m.id)
                  else n.add(m.id)
                  return n
                })
              }
              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-surface-2"
            >
              <span className="w-4 text-[12px] font-semibold tabular-nums text-subtle">{m.index}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{m.shortTitle}</span>
              <span className="text-[11.5px] tabular-nums text-subtle">
                {done}/{ls.length}
              </span>
              <ChevronRight
                className={cx('size-3.5 text-subtle transition-transform', isOpen && 'rotate-90')}
              />
            </button>
            {isOpen && (
              <ul className="pb-1">
                {ls.map((l) => (
                  <li key={l.id}>
                    <Link
                      to={`/learn/${l.id}`}
                      onClick={onNavigate}
                      aria-current={l.id === currentId ? 'page' : undefined}
                      className={cx(
                        'flex items-start gap-2 py-1.5 pl-10 pr-3 text-[13px] leading-snug',
                        l.id === currentId
                          ? 'bg-accent-soft font-medium text-fg'
                          : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      <StatusIcon
                        status={statuses[l.id]?.status ?? 'not_started'}
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      <span className="min-w-0">{plain(l.title)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
