import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Target,
  Terminal,
  Wrench,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { ExerciseWorkbench } from '../components/ExerciseWorkbench'
import { CodeBlock } from '../components/Markdown'
import { Badge, Card, Notice, ProgressBar, cx } from '../components/ui'
import { getModule, getStage } from '../content'
import { PROJECT, projectStages } from '../content/project'
import type { ProjectStage } from '../content/types'
import { toggleStageChecklist, useProgress } from '../lib/progress/store'
import { pythonRunner } from '../lib/python/runner'

export function ProjectPage() {
  const { stageId } = useParams()
  const lab = useProgress((p) => p.lab)
  const passed = projectStages.filter((s) => lab[s.exercise.id]?.passed).length
  useEffect(() => {
    pythonRunner.warmUp().catch(() => undefined)
  }, [])

  if (!stageId) {
    const first = projectStages.find((s) => !lab[s.exercise.id]?.passed) ?? projectStages[0]
    return <Navigate to={`/projects/travel-agent/${first.id}`} replace />
  }
  const stage = getStage(stageId)
  if (!stage) return <Navigate to="/projects/travel-agent" replace />

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title={PROJECT.title} description={PROJECT.pitch} />
      <div className="mb-6 flex items-center gap-3">
        <ProgressBar
          value={passed}
          max={projectStages.length}
          tone="success"
          className="max-w-xs"
          label="Tiến độ dự án"
        />
        <span className="text-[13px] tabular-nums text-muted">
          {passed}/{projectStages.length} giai đoạn đạt test
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Các giai đoạn" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {projectStages.map((s) => {
              const ok = lab[s.exercise.id]?.passed
              const active = s.id === stage.id
              return (
                <li key={s.id} className="shrink-0">
                  <Link
                    to={`/projects/travel-agent/${s.id}`}
                    aria-current={active ? 'step' : undefined}
                    className={cx(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13.5px] lg:border-transparent',
                      active
                        ? 'border-accent bg-accent-soft font-medium text-fg lg:border-accent/40'
                        : 'border-line text-muted hover:bg-surface hover:text-fg',
                    )}
                  >
                    <span
                      className={cx(
                        'grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold',
                        ok
                          ? 'bg-success text-white'
                          : active
                            ? 'bg-accent-strong text-white'
                            : 'bg-surface-2 text-muted',
                      )}
                    >
                      {ok ? <CheckCircle2 className="size-3.5" /> : s.index}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>
        <StageDetail key={stage.id} stage={stage} />
      </div>
    </div>
  )
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold [&>svg]:size-4">
        {icon}
        {title}
      </h3>
      {children}
    </Card>
  )
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-4 text-[13.5px] text-fg/90">
    {items.map((i) => (
      <li key={i}>{i.replace(/`/g, '')}</li>
    ))}
  </ul>
)

function StageDetail({ stage }: { stage: ProjectStage }) {
  const checks = useProgress((p) => p.stages[stage.id]?.checklist) ?? {}
  const done = stage.checklist.filter((_, i) => checks[i]).length
  return (
    <div className="min-w-0 space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Giai đoạn {stage.index}/10</Badge>
          {stage.moduleIds.map((id) => {
            const m = getModule(id)
            return m ? (
              <Link key={id} to={`/course#${id}`}>
                <Badge>
                  Module {m.index} · {m.shortTitle}
                </Badge>
              </Link>
            ) : null
          })}
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">{stage.title}</h2>
        <p className="mt-1 text-[14.5px] text-muted">{stage.goal.replace(/`/g, '')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Block icon={<Lightbulb className="text-accent" />} title="Kiến thức áp dụng">
          <div className="flex flex-wrap gap-1.5">
            {stage.concepts.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
        </Block>
        <Block icon={<Target className="text-accent" />} title="Yêu cầu đầu ra">
          <List items={stage.deliverable} />
        </Block>
        <Block
          icon={<ClipboardCheck className="text-success" />}
          title={`Checklist (${done}/${stage.checklist.length})`}
        >
          <ul className="space-y-1">
            {stage.checklist.map((c, i) => (
              <li key={c}>
                <label className="flex cursor-pointer items-start gap-2 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={!!checks[i]}
                    onChange={() => toggleStageChecklist(stage.id, i)}
                    className="mt-1 size-4 accent-[var(--accent-strong)]"
                  />
                  {c.replace(/`/g, '')}
                </label>
              </li>
            ))}
          </ul>
        </Block>
        <Block icon={<CheckCircle2 className="text-success" />} title="Tiêu chí đánh giá">
          <List items={stage.criteria} />
        </Block>
        <Block icon={<AlertTriangle className="text-warning" />} title="Lỗi thường gặp">
          <List items={stage.pitfalls} />
        </Block>
        <Block icon={<Wrench className="text-muted" />} title="Gợi ý cải tiến">
          <List items={stage.improvements} />
        </Block>
      </div>

      <Card className="p-4 sm:p-5">
        <ExerciseWorkbench exercise={stage.exercise} headingLevel={3} />
      </Card>

      {stage.localCode && (
        <Card className="p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Terminal className="size-4 text-accent" /> Chạy với stack thật: {stage.localCode.title}
          </h3>
          <Notice className="mt-3">
            Code này dùng thư viện và API thật nên <b>không chạy trong trình duyệt</b>. Chạy trên máy của bạn
            với Python 3.11+ và API key trong <code>.env</code>. API của các thư viện thay đổi nhanh — đối
            chiếu tài liệu chính thức với phiên bản bạn cài.
          </Notice>
          <CodeBlock code={stage.localCode.install} lang="bash" />
          <CodeBlock code={stage.localCode.code} lang="python" />
        </Card>
      )}
    </div>
  )
}
