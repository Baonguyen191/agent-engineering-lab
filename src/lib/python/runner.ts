import { labkitFiles } from '../../content/exercises'

export interface TestResult {
  name: string
  doc: string
  passed: boolean
  message: string
}

export type WorkerRequest =
  | { type: 'init' }
  | {
      type: 'run'
      id: string
      code: string
      tests?: string
      labkit: { name: string; code: string }[]
      packages: string[]
      env: Record<string, string>
    }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'status'; text: string }
  | { type: 'stdout' | 'stderr'; id: string; text: string }
  | { type: 'result'; id: string; ok: boolean; error?: string; tests?: TestResult[]; durationMs: number }
  | { type: 'fatal'; id: string; error: string }

export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

export interface RunResult {
  ok: boolean
  /** Python traceback, timeout or loader error. */
  error?: string
  tests?: TestResult[]
  durationMs?: number
  timedOut?: boolean
}

export interface RunOptions {
  code: string
  tests?: string
  packages?: string[]
  env?: Record<string, string>
  timeoutMs?: number
  onOutput?: (stream: 'stdout' | 'stderr', text: string) => void
}

type StatusListener = (s: RunnerStatus, detail: string) => void

/**
 * Owns one Pyodide worker. A run that exceeds its time limit terminates the worker (the only way to
 * stop a busy WebAssembly thread); the next run starts a fresh one.
 */
class PythonRunner {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private status: RunnerStatus = 'idle'
  private detail = ''
  private listeners = new Set<StatusListener>()
  private seq = 0

  onStatus(l: StatusListener): () => void {
    this.listeners.add(l)
    l(this.status, this.detail)
    return () => this.listeners.delete(l)
  }

  private setStatus(s: RunnerStatus, detail = '') {
    this.status = s
    this.detail = detail
    for (const l of this.listeners) l(s, detail)
  }

  /** Start loading Pyodide in the background. */
  warmUp(): Promise<void> {
    if (this.ready) return this.ready
    this.setStatus('loading', 'Đang tải Python (Pyodide)…')
    const worker = new Worker(new URL('./pyodide.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    this.ready = new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === 'ready') {
          worker.removeEventListener('message', onMessage)
          this.setStatus('ready')
          resolve()
        } else if (e.data.type === 'status') {
          this.setStatus('loading', e.data.text)
        } else if (e.data.type === 'fatal') {
          worker.removeEventListener('message', onMessage)
          this.fail(
            `Không tải được Pyodide: ${e.data.error}. Cần kết nối mạng tới cdn.jsdelivr.net ở lần chạy đầu.`,
          )
          reject(new Error(e.data.error))
        }
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', (e) => {
        this.fail(`Worker lỗi: ${e.message || 'không rõ nguyên nhân'}`)
        reject(new Error(e.message))
      })
      worker.postMessage({ type: 'init' } satisfies WorkerRequest)
    })
    return this.ready
  }

  private fail(detail: string) {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.setStatus('error', detail)
  }

  async run(opts: RunOptions): Promise<RunResult> {
    try {
      await this.warmUp()
    } catch {
      return { ok: false, error: this.detail }
    }
    const worker = this.worker!
    const id = `run-${++this.seq}`
    this.setStatus('running', 'Đang chạy…')
    return new Promise<RunResult>((resolve) => {
      const finish = (r: RunResult) => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        if (this.status === 'running') this.setStatus('ready')
        resolve(r)
      }
      const timer = setTimeout(() => {
        // Busy Python cannot be interrupted cooperatively here: kill the worker.
        worker.removeEventListener('message', onMessage)
        this.worker?.terminate()
        this.worker = null
        this.ready = null
        this.setStatus('idle', 'Worker đã được khởi động lại sau khi quá thời gian.')
        resolve({
          ok: false,
          timedOut: true,
          error: `Quá thời gian ${Math.round((opts.timeoutMs ?? 15000) / 1000)} giây — có thể code bị lặp vô hạn. Python đã bị dừng.`,
        })
      }, opts.timeoutMs ?? 15000)
      const onMessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data
        if (m.type === 'status') this.setStatus('running', m.text)
        else if ((m.type === 'stdout' || m.type === 'stderr') && m.id === id) opts.onOutput?.(m.type, m.text)
        else if (m.type === 'result' && m.id === id)
          finish({ ok: m.ok, error: m.error, tests: m.tests, durationMs: m.durationMs })
        else if (m.type === 'fatal' && m.id === id) finish({ ok: false, error: m.error })
      }
      worker.addEventListener('message', onMessage)
      worker.postMessage({
        type: 'run',
        id,
        code: opts.code,
        tests: opts.tests,
        labkit: labkitFiles,
        packages: opts.packages ?? [],
        env: opts.env ?? {},
      } satisfies WorkerRequest)
    })
  }
}

export const pythonRunner = new PythonRunner()
