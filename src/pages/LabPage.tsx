import { ArrowLeft, CheckCircle2, Code2, Cpu, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '../components/AppShell'
import { ExerciseWorkbench } from '../components/ExerciseWorkbench'
import { Badge, Card, Notice, SectionTitle } from '../components/ui'
import { exercises, getExercise, getLesson, modules } from '../content'
import { projectStages } from '../content/project'
import { pythonRunner } from '../lib/python/runner'
import { useProgress } from '../lib/progress/store'
import { NotFoundPage } from './NotFoundPage'

const DIFFICULTY = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const

export function LabPage() {
  const lab = useProgress((p) => p.lab)
  // Exercises that exist only for the project ("tp-*") are listed on the project page.
  const projectOnly = (id: string) => id.startsWith('tp-')
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Coding Lab"
        description="Bài tập Python chạy thật trong trình duyệt và được chấm bằng test. Các bài liên quan tới LLM dùng mock model mặc định (miễn phí, kết quả cố định) và có thể chuyển sang API thật."
      />
      <Notice className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <span className="inline-flex items-center gap-2">
            <Cpu className="size-4 shrink-0 text-accent" /> Python thật: CPython (Pyodide/WebAssembly) trong
            Web Worker.
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-success" /> Cô lập trong sandbox trình duyệt, tự dừng
            sau 15 giây.
          </span>
        </div>
        <div className="mt-2">
          Thư viện <code>labkit</code> trong lab là bản thu nhỏ do ứng dụng viết để mô phỏng ý tưởng của
          LangChain/LangGraph — không phải thư viện thật. Code cho stack thật nằm trong từng giai đoạn của{' '}
          <Link to="/projects/travel-agent" className="text-accent hover:underline">
            dự án
          </Link>
          .
        </div>
      </Notice>

      <div className="space-y-6">
        {modules.map((m) => {
          const list = exercises.filter((e) => e.moduleId === m.id && !projectOnly(e.id))
          if (!list.length) return null
          return (
            <section key={m.id}>
              <SectionTitle>
                Module {m.index} · {m.shortTitle}
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((e) => {
                  const st = lab[e.id]
                  return (
                    <Link key={e.id} to={`/lab/${e.id}`} className="group">
                      <Card className="h-full p-4 transition-colors group-hover:border-line-strong group-hover:bg-surface-2/50">
                        <div className="flex items-start gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                            {st?.passed ? (
                              <CheckCircle2 className="size-4 text-success" />
                            ) : (
                              <Code2 className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium leading-snug">{e.title}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <Badge>{DIFFICULTY[e.difficulty]}</Badge>
                              {e.usesLLM && <Badge tone="accent">Mock / API thật</Badge>}
                              {st?.passed ? (
                                <Badge tone="success">Đạt</Badge>
                              ) : st?.attempts ? (
                                <Badge tone="warning">
                                  Tốt nhất {st.bestPassed}/{st.total} test
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
        <section>
          <SectionTitle>Bài tập của dự án Travel Agent</SectionTitle>
          <p className="text-[14px] text-muted">
            Các giai đoạn dự án dùng lại bài lab của module tương ứng và thêm 4 bài riêng — mở từ trang{' '}
            <Link to="/projects/travel-agent" className="text-accent hover:underline">
              Dự án Travel Agent
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}

export function ExercisePage() {
  const { exerciseId = '' } = useParams()
  const exercise = getExercise(exerciseId)
  useEffect(() => {
    // Start downloading Python while the learner reads the brief.
    pythonRunner.warmUp().catch(() => undefined)
  }, [])
  if (!exercise) return <NotFoundPage what="Bài tập" />
  const stage = projectStages.find((s) => s.exercise.id === exercise.id)
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <Link to="/lab" className="inline-flex items-center gap-1 text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Coding Lab
        </Link>
        {stage && (
          <Link to={`/projects/travel-agent/${stage.id}`} className="text-muted hover:text-fg">
            Giai đoạn {stage.index} của dự án
          </Link>
        )}
        {exercise.lessonIds.map((id) => {
          const l = getLesson(id)
          return l ? (
            <Link key={id} to={`/learn/${id}`} className="text-accent hover:underline">
              Bài: {l.title.replace(/`/g, '')}
            </Link>
          ) : null
        })}
      </div>
      <ExerciseWorkbench exercise={exercise} headingLevel={2} />
    </div>
  )
}
