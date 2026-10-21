import { ArrowDown, ArrowRight, CornerUpLeft } from 'lucide-react'
import { Fragment } from 'react'

/**
 * Renders the ```flow fenced block: one edge chain per line, e.g. "A -> B -> C".
 * Each connected component is laid out in layers (longest path from its roots); edges that point
 * back to an earlier layer (loops) are shown as "↩ back to X" under the source node.
 */
export interface FlowGraph {
  nodes: string[]
  edges: [string, string][]
}

export function parseFlow(src: string): FlowGraph {
  const nodes: string[] = []
  const edges: [string, string][] = []
  const add = (n: string) => {
    if (!nodes.includes(n)) nodes.push(n)
  }
  for (const line of src.split('\n')) {
    const parts = line
      .split('->')
      .map((s) => s.trim())
      .filter(Boolean)
    parts.forEach(add)
    for (let i = 0; i + 1 < parts.length; i++) edges.push([parts[i], parts[i + 1]])
  }
  return { nodes, edges }
}

interface Layout {
  layers: string[][]
  backEdges: Map<string, string[]>
  linear: boolean
}

export function layoutFlow({ nodes, edges }: FlowGraph): Layout[] {
  // Split into weakly connected components, preserving first-appearance order.
  const comp = new Map<string, number>()
  let next = 0
  for (const n of nodes) {
    if (comp.has(n)) continue
    const stack = [n]
    comp.set(n, next)
    while (stack.length) {
      const cur = stack.pop() as string
      for (const [a, b] of edges) {
        const other = a === cur ? b : b === cur ? a : null
        if (other && !comp.has(other)) {
          comp.set(other, next)
          stack.push(other)
        }
      }
    }
    next++
  }

  const layouts: Layout[] = []
  for (let c = 0; c < next; c++) {
    const cn = nodes.filter((n) => comp.get(n) === c)
    const ce = edges.filter(([a]) => comp.get(a) === c)
    // Back edges: edges that close a cycle in DFS order from the first node.
    const back = new Set<string>()
    const state = new Map<string, 'open' | 'done'>()
    const dfs = (n: string) => {
      state.set(n, 'open')
      for (const [a, b] of ce) {
        if (a !== n) continue
        if (state.get(b) === 'open') back.add(`${a}\u0000${b}`)
        else if (!state.has(b)) dfs(b)
      }
      state.set(n, 'done')
    }
    cn.forEach((n) => !state.has(n) && dfs(n))
    const forward = ce.filter(([a, b]) => !back.has(`${a}\u0000${b}`))
    const depth = new Map<string, number>(cn.map((n) => [n, 0]))
    for (let i = 0; i < cn.length; i++) {
      for (const [a, b] of forward) depth.set(b, Math.max(depth.get(b)!, depth.get(a)! + 1))
    }
    const layers: string[][] = []
    for (const n of cn) (layers[depth.get(n)!] ??= []).push(n)
    const backEdges = new Map<string, string[]>()
    for (const key of back) {
      const [a, b] = key.split('\u0000')
      backEdges.set(a, [...(backEdges.get(a) ?? []), b])
    }
    layouts.push({ layers, backEdges, linear: layers.every((l) => l.length === 1) && back.size === 0 })
  }
  return layouts
}

function Node({ label, back }: { label: string; back?: string[] }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-center text-[13px] font-medium leading-snug text-fg">
        {label}
      </div>
      {back?.map((b) => (
        <div key={b} className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-warning">
          <CornerUpLeft className="size-3" aria-hidden /> quay lại “{b}”
        </div>
      ))}
    </div>
  )
}

export function FlowDiagram({ source }: { source: string }) {
  const layouts = layoutFlow(parseFlow(source))
  return (
    <figure
      className="not-prose my-5 space-y-4 rounded-xl border border-line bg-surface-2/60 p-4"
      aria-label="Sơ đồ luồng"
    >
      {layouts.map((lay, i) =>
        lay.linear ? (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {lay.layers.map(([n], j) => (
              <Fragment key={n}>
                {j > 0 && <ArrowRight className="size-4 shrink-0 text-subtle" aria-hidden />}
                <Node label={n} />
              </Fragment>
            ))}
          </div>
        ) : (
          <div key={i} className="flex flex-col items-center gap-2">
            {lay.layers.map((layer, j) => (
              <Fragment key={j}>
                {j > 0 && <ArrowDown className="size-4 text-subtle" aria-hidden />}
                <div className="flex flex-wrap justify-center gap-2">
                  {layer.map((n) => (
                    <Node key={n} label={n} back={lay.backEdges.get(n)} />
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        ),
      )}
    </figure>
  )
}
