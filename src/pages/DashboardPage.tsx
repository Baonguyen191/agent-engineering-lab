import { ArrowRight, BookOpenCheck, Flame, PlayCircle, Repeat2, Target, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { Badge, Card, EmptyState, ProgressBar, SectionTitle, Stat, StatusIcon, cx } from '../components/ui'
import { VIDEO } from '../content/course'
import { contentIndex, getModule } from '../content'
import { formatDuration, formatTimestamp, percent } from '../lib/format'
import { dashboardStats, lessonStatus, type DashboardStats } from '../lib/progress/selectors'
import { useProgress } from '../lib/progress/store'

const plain = (s: string) => s.replace(/`/g, '')

export function DashboardPage() {
  const progress = useProgress((p) => p)
  const stats = useMemo(() => dashboardStats(progress, contentIndex, new Date()), [progress])
  const isNew = stats.completedLessons === 0 && progress.quizAttempts.length === 0 && !progress.lastLessonId

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Tổng quan"
        description={
          isNew
            ? 'Chào mừng! Mọi con số dưới đây được tính từ việc học thực tế của bạn — hiện chưa có dữ liệu nào.'
            : 'Tiến độ, điểm yếu và việc nên làm tiếp theo, tính từ dữ liệu học của bạn.'
        }
      />

      <NextStep stats={stats} isNew={isNew} />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <Stat
            label="Bài đã hoàn thành"
            value={`${stats.completedLessons}/${stats.totalLessons}`}
            hint={`${percent(stats.completedLessons, stats.totalLessons)}% khóa học`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Video đã học xong"
            value={formatDuration(stats.completedVideoSeconds)}
            hint={`trên ${formatDuration(VIDEO.durationSeconds)} · đã xem trong app ${formatDuration(stats.watchedSeconds)}`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Chuỗi ngày học"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Flame className={cx('size-5', stats.streakDays ? 'text-warning' : 'text-subtle')} />
                {stats.streakDays} ngày
              </span>
            }
            hint={`${stats.activeDays} ngày có hoạt động`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Độ chính xác quiz"
            value={stats.quiz.rate === null ? '—' : `${Math.round(stats.quiz.rate * 100)}%`}
            hint={
              stats.quiz.answered
                ? `${stats.quiz.correct}/${stats.quiz.answered} câu (lần trả lời gần nhất)`
                : 'Chưa làm quiz nào'
            }
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <SectionTitle
            action={
              <Link to="/course" className="text-[13px] text-accent hover:underline">
                Xem lộ trình
              </Link>
            }
          >
            Tiến độ theo module
          </SectionTitle>
          <Card className="divide-y divide-line">
            {stats.modules.map(({ module: m, total, completed }) => (
              <Link
                key={m.id}
                to={`/course#${m.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-[12px] font-semibold tabular-nums text-muted">
                  {m.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium">{m.title}</span>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-muted">
                      {completed}/{total}
                    </span>
                  </div>
                  <ProgressBar
                    value={completed}
                    max={total}
                    tone={completed === total && total > 0 ? 'success' : 'accent'}
                    className="mt-2"
                    label={`Tiến độ ${m.shortTitle}`}
                  />
                </div>
              </Link>
            ))}
          </Card>

          {stats.inProgress.length > 0 && (
            <div className="mt-6">
              <SectionTitle>Đang học dở</SectionTitle>
              <Card className="divide-y divide-line">
                {stats.inProgress.slice(0, 5).map((l) => (
                  <Link
                    key={l.id}
                    to={`/learn/${l.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                  >
                    <StatusIcon status="in_progress" />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{plain(l.title)}</span>
                    <span className="text-[12px] text-subtle">{getModule(l.moduleId)?.shortTitle}</span>
                  </Link>
                ))}
              </Card>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          <section>
            <SectionTitle
              action={
                <Link to="/review" className="text-[13px] text-accent hover:underline">
                  Ôn ngay
                </Link>
              }
            >
              Lịch ôn tập 7 ngày
            </SectionTitle>
            <Card className="p-4">
              <ReviewForecast forecast={stats.forecast} dueNow={stats.dueNow} />
            </Card>
          </section>

          <section>
            <SectionTitle>Chủ đề cần củng cố</SectionTitle>
            <Card>
              {stats.weak.length ? (
                <ul className="divide-y divide-line">
                  {stats.weak.slice(0, 5).map(({ lesson, accuracy }) => (
                    <li key={lesson.id}>
                      <Link
                        to={`/learn/${lesson.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px]">{plain(lesson.title)}</span>
                        <Badge tone="danger">
                          {accuracy.correct}/{accuracy.answered} đúng
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Target />} title="Chưa phát hiện điểm yếu" className="py-6">
                  Chủ đề có tỷ lệ đúng dưới 70% (từ 2 câu trở lên) sẽ xuất hiện ở đây.
                </EmptyState>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Dự án & Lab</SectionTitle>
            <Card className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <Link to="/projects/travel-agent" className="font-medium hover:text-accent">
                    Travel Planning Agent
                  </Link>
                  <span className="tabular-nums text-muted">
                    {stats.stagesPassed}/{stats.totalStages} giai đoạn
                  </span>
                </div>
                <ProgressBar
                  value={stats.stagesPassed}
                  max={stats.totalStages}
                  tone="success"
                  label="Tiến độ dự án"
                />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <Link to="/lab" className="font-medium hover:text-accent">
                    Bài tập Coding Lab
                  </Link>
                  <span className="tabular-nums text-muted">
                    {stats.labPassed}/{stats.totalExercises} đạt
                  </span>
                </div>
                <ProgressBar
                  value={stats.labPassed}
                  max={stats.totalExercises}
                  tone="success"
                  label="Tiến độ lab"
                />
              </div>
            </Card>
          </section>
        </aside>
      </div>
    </div>
  )
}

function NextStep({ stats, isNew }: { stats: DashboardStats; isNew: boolean }) {
  const rec = stats.recommendation
  const progress = useProgress((p) => p)
  let icon = <PlayCircle className="size-5" />
  let eyebrow = 'Tiếp tục học'
  let title = ''
  let detail = ''
  let to = '/course'
  let cta = 'Mở lộ trình'

  if (rec.kind === 'continue') {
    const l = rec.lesson
    const m = getModule(l.moduleId)
    const status = lessonStatus(progress, l.id)
    eyebrow = isNew ? 'Bắt đầu từ đây' : status === 'in_progress' ? 'Đang học dở' : 'Bài tiếp theo'
    title = plain(l.title)
    detail = `Module ${m?.index} · ${m?.shortTitle}${
      l.video
        ? ` · video ${formatTimestamp(l.video.start)}–${formatTimestamp(l.video.end)}`
        : ' · tài liệu bổ sung'
    }`
    to = `/learn/${l.id}`
    cta = isNew ? 'Bắt đầu bài đầu tiên' : 'Tiếp tục học'
  } else if (rec.kind === 'review') {
    icon = <Repeat2 className="size-5" />
    eyebrow = 'Nên ôn tập trước'
    title = `${rec.count} mục đến hạn ôn`
    detail = 'Ôn đúng hạn giúp kiến thức chuyển vào trí nhớ dài hạn (spaced repetition).'
    to = '/review'
    cta = 'Bắt đầu ôn'
  } else if (rec.kind === 'relearn') {
    icon = <BookOpenCheck className="size-5" />
    eyebrow = 'Củng cố điểm yếu'
    title = plain(rec.topic.lesson.title)
    detail = `Bạn đúng ${rec.topic.accuracy.correct}/${rec.topic.accuracy.answered} câu ở bài này. Đọc lại rồi làm lại quiz.`
    to = `/learn/${rec.topic.lesson.id}`
    cta = 'Học lại bài này'
  } else {
    icon = <Trophy className="size-5" />
    eyebrow = 'Hoàn thành'
    title = 'Bạn đã học xong toàn bộ khóa học'
    detail = 'Hoàn thiện dự án Travel Agent và duy trì lịch ôn tập.'
    to = '/projects/travel-agent'
    cta = 'Mở dự án'
  }

  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-linear-to-br from-accent-soft to-transparent p-5 sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-strong text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-accent">{eyebrow}</div>
        <div className="mt-0.5 text-lg font-semibold leading-snug">{title}</div>
        <div className="mt-0.5 text-[13.5px] text-muted">{detail}</div>
      </div>
      <Link
        to={to}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-medium text-white hover:bg-accent"
      >
        {cta} <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}

function ReviewForecast({ forecast, dueNow }: { forecast: number[]; dueNow: number }) {
  const max = Math.max(1, ...forecast)
  const days = [
    'Hôm nay',
    ...forecast.slice(1).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i + 1)
      return d.toLocaleDateString('vi-VN', { weekday: 'short' })
    }),
  ]
  const total = forecast.reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Đến hạn ngay</span>
        <span className="text-xl font-semibold tabular-nums">{dueNow}</span>
      </div>
      {total === 0 ? (
        <p className="text-[13px] text-subtle">
          Chưa có lịch ôn. Thẻ được lên lịch khi bạn ôn flashcard hoặc trả lời sai một câu quiz.
        </p>
      ) : (
        <div
          className="flex h-24 items-end gap-1.5"
          role="img"
          aria-label={`Số mục ôn 7 ngày tới: ${forecast.join(', ')}`}
        >
          {forecast.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums text-muted">{n || ''}</span>
              <div
                className={cx('w-full rounded-t', i === 0 ? 'bg-accent' : 'bg-accent/40')}
                style={{ height: `${Math.max(n ? 8 : 2, (n / max) * 64)}px` }}
              />
              <span className="text-[10.5px] text-subtle">{days[i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
