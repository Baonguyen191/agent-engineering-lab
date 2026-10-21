/// <reference lib="webworker" />
/**
 * Runs learner Python code with Pyodide (CPython compiled to WebAssembly) inside a Web Worker.
 * Isolation: the code runs in the browser sandbox, off the main thread, with no access to the page.
 * The main thread enforces a time limit by terminating this worker (see runner.ts).
 */
import type { WorkerRequest, WorkerResponse } from './runner'

const PYODIDE_VERSION = '0.28.3'
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

interface PyodideLike {
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void }
  loadPackage(names: string[]): Promise<unknown>
  setStdout(opts: { batched: (s: string) => void }): void
  setStderr(opts: { batched: (s: string) => void }): void
  runPythonAsync(code: string): Promise<unknown>
  globals: { get(name: string): unknown }
}

declare const self: DedicatedWorkerGlobalScope & { labBridge?: unknown }

let pyodide: PyodideLike | null = null
let currentId = ''
const post = (msg: WorkerResponse) => self.postMessage(msg)

/**
 * Synchronous HTTP used by labkit.llm.RealChatModel. Synchronous XHR is allowed in workers, which
 * lets ordinary (non-async) Python call a real LLM API.
 */
self.labBridge = {
  postJsonSync(url: string, headersJson: string, body: string): string {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, false)
      xhr.setRequestHeader('Content-Type', 'application/json')
      for (const [k, v] of Object.entries(JSON.parse(headersJson) as Record<string, string>))
        xhr.setRequestHeader(k, v)
      xhr.send(body)
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText
      return JSON.stringify({ __error__: `HTTP ${xhr.status}: ${xhr.responseText.slice(0, 400)}` })
    } catch (e) {
      return JSON.stringify({ __error__: `Network/CORS error: ${(e as Error).message}` })
    }
  },
}

const HARNESS = `
import json, os, sys, traceback

if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")

def __lab_format(e):
    tb = traceback.TracebackException.from_exception(e)
    tb.stack = traceback.StackSummary.from_list(
        [f for f in tb.stack if f.filename in ("main.py", "tests.py") or "labkit" in f.filename]
    )
    return "".join(tb.format())

def __lab_run(code, tests, env_json):
    for k in [m for m in sys.modules if m == "labkit" or m.startswith("labkit.")]:
        del sys.modules[k]
    for k, v in json.loads(env_json).items():
        os.environ[k] = v
    ns = {"__name__": "__main__" if tests is None else "exercise"}
    try:
        try:
            exec(compile(code, "main.py", "exec"), ns)
        except BaseException as e:
            return json.dumps({"ok": False, "error": __lab_format(e)})
        if tests is None:
            return json.dumps({"ok": True})
        try:
            exec(compile(tests, "tests.py", "exec"), ns)
        except BaseException as e:
            return json.dumps({"ok": False, "error": __lab_format(e)})
        from labkit.testing import run_tests
        return json.dumps({"ok": True, "tests": json.loads(run_tests(ns))})
    finally:
        os.environ.pop("LAB_LLM_API_KEY", None)
`

async function init(): Promise<PyodideLike> {
  if (pyodide) return pyodide
  post({ type: 'status', text: 'Đang tải Python (Pyodide)…' })
  const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as {
    loadPyodide(opts: { indexURL: string }): Promise<PyodideLike>
  }
  const py = await mod.loadPyodide({ indexURL: INDEX_URL })
  py.setStdout({ batched: (text) => post({ type: 'stdout', id: currentId, text }) })
  py.setStderr({ batched: (text) => post({ type: 'stderr', id: currentId, text }) })
  await py.runPythonAsync(HARNESS)
  py.FS.mkdirTree('/home/pyodide/labkit')
  pyodide = py
  return py
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  const id = msg.type === 'run' ? msg.id : ''
  try {
    const py = await init()
    if (msg.type === 'init') {
      post({ type: 'ready' })
      return
    }
    currentId = msg.id
    for (const f of msg.labkit) py.FS.writeFile(`/home/pyodide/labkit/${f.name}`, f.code)
    if (msg.packages.length) {
      post({ type: 'status', text: `Đang tải package: ${msg.packages.join(', ')}…` })
      await py.loadPackage(msg.packages)
    }
    post({ type: 'status', text: 'Đang chạy…' })
    const started = performance.now()
    const run = py.globals.get('__lab_run') as (code: string, tests: string | null, env: string) => string
    const result = JSON.parse(run(msg.code, msg.tests ?? null, JSON.stringify(msg.env))) as {
      ok: boolean
      error?: string
      tests?: { name: string; doc: string; passed: boolean; message: string }[]
    }
    post({ type: 'result', id, durationMs: Math.round(performance.now() - started), ...result })
  } catch (e) {
    post({ type: 'fatal', id, error: (e as Error).message })
  }
}
