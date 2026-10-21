import { ChevronDown, Code2, ExternalLink, FileText, HelpCircle, Search, SearchX, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { Badge, Card, EmptyState, ProgressBar, StatusIcon, Tabs, cx } from '../components/ui'
import { SOURCE_NOTE, VIDEO } from '../content/course'
import { contentIndex, lessons, modules, questionsOfLesson } from '../content'
import type { Lesson } from '../content/types'
import { formatDuration, formatTimestamp } from '../lib/format'
import { continueLesson, lessonStatus, lessonsNeedingReview } from '../lib/progress/selectors'
import { useProgress } from '../lib/progress/store'
import { searchLessons } from '../lib/search'

type Filter = 'all' | 'todo' | 'in_progress' | 'completed' | 'review'

export function CoursePage() {
  const progress = useProgress((p) => p)
  const { hash } = useLocation()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const needsReview = useMemo(() => lessonsNeedingReview(progress, contentIndex, new Date()), [progress])
  const next = useMemo(() => continueLesson(progress, contentIndex), [progress])
  const [open, setOpen] = useState<Set<string>>(() => new Set([hash.slice(1) || next?.moduleId || 'm1']))

  const visible = useMemo(() => {
    const found = new Set(searchLessons(lessons, modules, query).map((l) => l.id))
    return lessons.filter((l) => {
      if (!found.has(l.id)) return false
      const s = lessonStatus(progress, l.id)
      if (filter === 'todo') return s === 'not_started'
      if (filter === 'in_progress') return s === 'in_progress'
      if (filter === 'completed') return s === 'completed'
      if (filter === 'review') return needsReview.has(l.id)
      return true
    })
  }, [query, filter, progress, needsReview])

  const filtering = query.trim() !== '' || filter !== 'all'
  const count = (f: Filter) =>
    lessons.filter((l) => {
      const s = lessonStatus(progress, l.id)
      return f === 'todo' ? s === 'not_started' : f === 'review' ? needsReview.has(l.id) : s === f
    }).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Lộ trình khóa học"
        description={
          <>
            8 module · {lessons.length} bài · video {formatDuration(VIDEO.durationSeconds)} của{' '}
            {VIDEO.instructor}.{' '}
            <a
              href={VIDEO.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              Mở video gốc <ExternalLink className="inline size-3" />
            </a>
          </>
        }
      />

      <div className="sticky top-14 z-20 -mx-4 mb-4 space-y-3 bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bài theo tên, chủ đề, framework, thuật ngữ (vd: interrupt, chunking, LiteLLM)…"
            aria-label="Tìm bài học"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[14px] outline-none placeholder:text-subtle focus:border-accent"
          />
        </label>
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'all', label: 'Tất cả', count: lessons.length },
            { id: 'todo', label: 'Chưa học', count: count('todo') },
            { id: 'in_progress', label: 'Đang học', count: count('in_progress') },
            { id: 'completed', label: 'Đã hoàn thành', count: count('completed') },
            { id: 'review', label: 'Cần ôn tập', count: count('review') },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<SearchX />} title="Không có bài nào khớp">
          {filter === 'review'
            ? 'Chưa có bài nào cần ôn: bài cần ôn là bài có câu quiz trả lời sai hoặc có mục ôn đến hạn.'
            : 'Thử từ khóa khác hoặc bỏ bộ lọc.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => {
            const mLessons = visible.filter((l) => l.moduleId === m.id)
            if (!mLessons.length) return null
            const all = lessons.filter((l) => l.moduleId === m.id)
            const done = all.filter((l) => lessonStatus(progress, l.id) === 'completed').length
            const isOpen = filtering || open.has(m.id)
            return (
              <Card key={m.id} id={m.id} className="scroll-mt-40 overflow-hidden">
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
                  className="flex w-full items-start gap-4 p-4 text-left hover:bg-surface-2/60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-[14px] font-semibold text-accent">
                    {m.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold">{m.title}</h2>
                      <Badge>
                        <Video className="size-3" /> {formatTimestamp(m.video.start)}–
                        {formatTimestamp(m.video.end)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[13.5px] text-muted">{m.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <ProgressBar
                        value={done}
                        max={all.length}
                        className="max-w-56"
                        tone={done === all.length ? 'success' : 'accent'}
                        label={`Tiến độ ${m.shortTitle}`}
                      />
                      <span className="text-[12.5px] tabular-nums text-muted">
                        {done}/{all.length} bài · {formatDuration(m.video.end - m.video.start)} video
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cx(
                      'mt-2 size-4 shrink-0 text-subtle transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-line">
                    {!filtering && (
                      <div className="grid gap-4 bg-surface-2/40 px-4 py-3 text-[13px] sm:grid-cols-2">
                        <div>
                          <div className="mb-1 font-medium text-muted">Mục tiêu</div>
                          <ul className="list-disc space-y-0.5 pl-4 text-fg/90">
                            {m.goals.map((g) => (
                              <li key={g}>{g.replace(/`/g, '')}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="font-medium text-muted">Cần biết trước: </span>
                            {m.prerequisites.join(' · ').replace(/`/g, '')}
                          </div>
                          <div>
                            <span className="font-medium text-muted">Mini-project: </span>
                            {m.miniProject.title} — {m.miniProject.brief.replace(/`/g, '')}
                          </div>
                          {m.repo && (
                            <a
                              href={m.repo.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              {m.repo.label} <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    <ul className="divide-y divide-line">
                      {mLessons.map((l) => (
                        <LessonRow
                          key={l.id}
                          lesson={l}
                          status={lessonStatus(progress, l.id)}
                          review={needsReview.has(l.id)}
                          isNext={next?.id === l.id}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      <p className="mt-6 text-[12.5px] leading-relaxed text-subtle">{SOURCE_NOTE}</p>
    </div>
  )
}

function LessonRow({
  lesson: l,
  status,
  review,
  isNext,
}: {
  lesson: Lesson
  status: ReturnType<typeof lessonStatus>
  review: boolean
  isNext: boolean
}) {
  const quizCount = questionsOfLesson(l.id).length
  return (
    <li>
      <Link
        to={`/learn/${l.id}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <StatusIcon status={status} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-medium">{l.title.replace(/`/g, '')}</span>
            {isNext && <Badge tone="accent">Tiếp theo</Badge>}
            {review && <Badge tone="warning">Cần ôn</Badge>}
            {l.source === 'supplement' && <Badge>Tài liệu bổ sung</Badge>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{l.summary.replace(/`/g, '')}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-subtle">
            {l.video ? (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3" /> {formatTimestamp(l.video.start)}–{formatTimestamp(l.video.end)} (
                {formatDuration(l.video.end - l.video.start)})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" /> Không có đoạn video tương ứng
              </span>
            )}
            <span>~{l.studyMinutes} phút đọc & luyện</span>
            {quizCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <HelpCircle className="size-3" /> {quizCount} câu quiz
              </span>
            )}
            {l.exercises?.length ? (
              <span className="inline-flex items-center gap-1">
                <Code2 className="size-3" /> {l.exercises.length} bài lab
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  )
}
