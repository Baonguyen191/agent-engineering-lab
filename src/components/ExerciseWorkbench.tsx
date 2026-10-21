import {
  CheckCircle2,
  Cloud,
  Cpu,
  FlaskConical,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  ScrollText,
  XCircle,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Exercise } from '../content/types'
import { isLlmConfigured, llmEnv, useLlmConfig } from '../lib/llmConfig'
import {
  getProgress,
  markSolutionViewed,
  recordLabRun,
  revealHint,
  saveLabCode,
  useProgress,
} from '../lib/progress/store'
import { pythonRunner, type RunnerStatus, type TestResult } from '../lib/python/runner'
import { CodeBlock, Markdown } from './Markdown'
import { Badge, Button, ConfirmDialog, Notice, Tabs, cx } from './ui'

const CodeEditor = lazy(() => import('./CodeEditor'))

const DIFFICULTY = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const

type OutputLine = { stream: 'stdout' | 'stderr' | 'info' | 'error'; text: string }

export function ExerciseWorkbench({
  exercise,
  headingLevel = 2,
}: {
  exercise: Exercise
  headingLevel?: 2 | 3
}) {
  const saved = useProgress((p) => p.lab[exercise.id])
  const [code, setCode] = useState(() => getProgress().lab[exercise.id]?.code ?? exercise.starter)
  const [mode, setMode] = useState<'mock' | 'real'>('mock')
  const [busy, setBusy] = useState<null | 'run' | 'test'>(null)
  const [status, setStatus] = useState<{ s: RunnerStatus; detail: string }>({ s: 'idle', detail: '' })
  const [output, setOutput] = useState<OutputLine[]>([])
  const [tests, setTests] = useState<TestResult[] | null>(null)
  const [tab, setTab] = useState<'console' | 'tests'>('console')
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSolution, setConfirmSolution] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const llm = useLlmConfig()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Switching to another exercise (same component instance): load its code.
  const [currentId, setCurrentId] = useState(exercise.id)
  if (currentId !== exercise.id) {
    setCurrentId(exercise.id)
    setCode(getProgress().lab[exercise.id]?.code ?? exercise.starter)
    setOutput([])
    setTests(null)
    setShowSolution(false)
    setMode('mock')
  }

  useEffect(() => pythonRunner.onStatus((s, detail) => setStatus({ s, detail })), [])
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const onChange = (v: string) => {
    setCode(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveLabCode(exercise.id, v), 400)
  }

  const realReady = isLlmConfigured(llm)
  const hintsShown = saved?.hintsShown ?? 0

  async function execute(kind: 'run' | 'test') {
    if (busy) return
    if (mode === 'real' && !realReady) return
    setBusy(kind)
    saveLabCode(exercise.id, code)
    const lines: OutputLine[] = [
      {
        stream: 'info',
        text: `▶ ${kind === 'run' ? 'Chạy main.py' : 'Chạy main.py + tests.py'} · Python (Pyodide) · LLM: ${
          mode === 'mock' || kind === 'test' ? 'mock (không gọi mạng)' : `${llm.model} @ ${llm.baseUrl}`
        }`,
      },
    ]
    setOutput([...lines])
    if (kind === 'test') setTab('tests')
    else setTab('console')
    const result = await pythonRunner.run({
      code,
      tests: kind === 'test' ? exercise.tests : undefined,
      packages: exercise.packages,
      // Tests always use the mock so grading is deterministic and free.
      env: llmEnv(kind === 'test' ? 'mock' : mode),
      timeoutMs: mode === 'real' && kind === 'run' ? 90000 : 15000,
      onOutput: (stream, text) => {
        lines.push({ stream, text })
        setOutput([...lines])
      },
    })
    if (result.error) lines.push({ stream: 'error', text: result.error })
    if (result.durationMs !== undefined)
      lines.push({ stream: 'info', text: `✓ Kết thúc sau ${result.durationMs} ms` })
    setOutput([...lines])
    if (kind === 'test') {
      setTests(result.tests ?? [])
      const passed = (result.tests ?? []).filter((t) => t.passed).length
      recordLabRun(exercise.id, code, result.ok ? passed : 0, result.tests?.length ?? 0)
      if (!result.ok) setTab('console')
    }
    setBusy(null)
  }

  const passedCount = tests?.filter((t) => t.passed).length ?? 0
  const H = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <H className="text-lg font-semibold tracking-tight">{exercise.title}</H>
          <Badge
            tone={
              exercise.difficulty === 'hard'
                ? 'warning'
                : exercise.difficulty === 'medium'
                  ? 'accent'
                  : 'neutral'
            }
          >
            {DIFFICULTY[exercise.difficulty]}
          </Badge>
          {saved?.passed && (
            <Badge tone="success">
              <CheckCircle2 className="size-3" /> Đã qua tất cả test
            </Badge>
          )}
        </div>
        <Markdown className="mt-2 max-w-none text-[14.5px]">{exercise.brief}</Markdown>
        <ul className="mt-3 space-y-1 text-[14px]">
          {exercise.requirements.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <Markdown className="max-w-none [&>p]:m-0">{r}</Markdown>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => execute('test')} loading={busy === 'test'} disabled={!!busy}>
          <FlaskConical className="size-4" /> Chạy test
        </Button>
        <Button onClick={() => execute('run')} loading={busy === 'run'} disabled={!!busy}>
          <Play className="size-4" /> Chạy
        </Button>
        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={!!busy}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        {exercise.usesLLM && (
          <div
            className="ml-auto flex items-center gap-1 rounded-lg border border-line p-0.5"
            role="radiogroup"
            aria-label="Chế độ LLM"
          >
            {(['mock', 'real'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cx(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium',
                  mode === m ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {m === 'mock' ? <Cpu className="size-3.5" /> : <Cloud className="size-3.5" />}
                {m === 'mock' ? 'Mock LLM' : 'API thật'}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'real' && !realReady && (
        <Notice tone="warning">
          Chế độ API thật cần base URL, model và API key.{' '}
          <Link to="/settings" className="font-medium text-accent underline">
            Cấu hình ở trang Cài đặt
          </Link>{' '}
          (API key chỉ giữ trong bộ nhớ tab, không lưu vào trình duyệt).
        </Notice>
      )}
      {mode === 'real' && realReady && (
        <Notice tone="accent">
          Code sẽ gửi request thật tới <code>{llm.baseUrl}</code> (model <code>{llm.model}</code>) và có thể
          phát sinh phí. Test vẫn dùng mock để kết quả ổn định; nút <b>Chạy</b> mới gọi API thật. Một số
          provider chặn gọi trực tiếp từ trình duyệt (CORS).
        </Notice>
      )}

      <Suspense
        fallback={
          <div className="grid h-[440px] place-items-center rounded-xl border border-line bg-code text-sm text-[#9aa3b5]">
            Đang tải trình soạn thảo…
          </div>
        }
      >
        <CodeEditor value={code} onChange={onChange} label={`Code bài ${exercise.title}`} />
      </Suspense>

      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1.5">
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'console', label: 'Console' },
              { id: 'tests', label: 'Test', count: tests ? passedCount : undefined },
            ]}
          />
          <RunnerStatusLabel status={status.s} detail={status.detail} />
        </div>
        <div className="max-h-80 min-h-32 overflow-auto p-3">
          {tab === 'console' ? (
            output.length ? (
              <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed">
                {output.map((l, i) => (
                  <div
                    key={i}
                    className={cx(
                      l.stream === 'stderr' || l.stream === 'error'
                        ? 'text-danger'
                        : l.stream === 'info'
                          ? 'text-subtle'
                          : 'text-fg',
                    )}
                  >
                    {l.text}
                  </div>
                ))}
              </pre>
            ) : (
              <p className="text-[13px] text-subtle">
                Bấm <b>Chạy</b> để chạy code (khối <code>if __name__ == "__main__"</code> sẽ chạy) hoặc{' '}
                <b>Chạy test</b> để chấm bài. Lần đầu cần tải Python (~10 MB).
              </p>
            )
          ) : tests ? (
            <TestList tests={tests} />
          ) : (
            <p className="text-[13px] text-subtle">Chưa chạy test.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <Lightbulb className="size-4 text-warning" /> Gợi ý ({Math.min(hintsShown, exercise.hints.length)}
            /{exercise.hints.length})
          </div>
          <ol className="space-y-2 text-[13.5px]">
            {exercise.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                <span className="mr-1 font-semibold text-muted">{i + 1}.</span>
                <Markdown className="inline max-w-none [&>p]:inline">{h}</Markdown>
              </li>
            ))}
          </ol>
          {hintsShown < exercise.hints.length && (
            <Button size="sm" className="mt-2" onClick={() => revealHint(exercise.id, code, hintsShown + 1)}>
              Hiện gợi ý {hintsShown + 1}
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <ScrollText className="size-4 text-accent" /> Lời giải tham khảo
          </div>
          {showSolution ? (
            <CodeBlock code={exercise.solution} lang="python" className="my-0 max-h-96 overflow-auto" />
          ) : (
            <>
              <p className="text-[13.5px] text-muted">
                Thử hết gợi ý trước. Lời giải đã được kiểm chứng: chạy qua toàn bộ test bằng CPython.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setConfirmSolution(true)}>
                Xem lời giải
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset code về starter?"
        confirmLabel="Reset"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setCode(exercise.starter)
          saveLabCode(exercise.id, exercise.starter)
          setOutput([])
          setTests(null)
        }}
      >
        Code hiện tại của bài này sẽ bị thay bằng code khởi đầu. Kết quả test đã đạt trước đó vẫn được giữ.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmSolution}
        title="Xem lời giải?"
        confirmLabel="Xem lời giải"
        onClose={() => setConfirmSolution(false)}
        onConfirm={() => {
          setShowSolution(true)
          markSolutionViewed(exercise.id, code)
        }}
      >
        Tự giải giúp nhớ lâu hơn nhiều. Việc xem lời giải sẽ được ghi nhận trong tiến độ của bài.
      </ConfirmDialog>
    </div>
  )
}

function TestList({ tests }: { tests: TestResult[] }) {
  if (!tests.length)
    return <p className="text-[13px] text-danger">Không chạy được test — xem tab Console để biết lỗi.</p>
  const passed = tests.filter((t) => t.passed).length
  return (
    <div>
      <p
        className={cx(
          'mb-2 text-[13px] font-medium',
          passed === tests.length ? 'text-success' : 'text-warning',
        )}
      >
        {passed}/{tests.length} test đạt
      </p>
      <ul className="space-y-1.5">
        {tests.map((t) => (
          <li key={t.name} className="rounded-lg border border-line px-3 py-2">
            <div className="flex items-start gap-2 text-[13px]">
              {t.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              )}
              <div className="min-w-0">
                <div className="font-mono text-[12.5px]">{t.name}</div>
                {t.doc && <div className="text-muted">{t.doc}</div>}
                {!t.passed && (
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[12px] text-danger">
                    {t.message}
                  </pre>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RunnerStatusLabel({ status, detail }: { status: RunnerStatus; detail: string }) {
  const text =
    status === 'ready'
      ? 'Python sẵn sàng'
      : status === 'idle'
        ? detail || 'Python chưa tải'
        : status === 'error'
          ? 'Lỗi'
          : detail
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2 text-[12px]',
        status === 'error' ? 'text-danger' : status === 'ready' ? 'text-success' : 'text-muted',
      )}
      title={detail}
    >
      {(status === 'loading' || status === 'running') && <Loader2 className="size-3.5 animate-spin" />}
      {text}
    </span>
  )
}
