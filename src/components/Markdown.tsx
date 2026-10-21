import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import yaml from 'highlight.js/lib/languages/yaml'
import { Check, Copy, Eye, PlayCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatTimestamp } from '../lib/format'
import { FlowDiagram } from './FlowDiagram'
import { cx } from './ui'

hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)

interface HastNode {
  type: string
  value?: string
  tagName?: string
  properties?: { className?: string[] | string }
  children?: HastNode[]
}

const hastText = (n: HastNode): string =>
  n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(hastText).join('')

export function CodeBlock({ code, lang, className }: { code: string; lang?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const known = lang && hljs.getLanguage(lang)
  const html = known ? hljs.highlight(code, { language: lang }).value : null
  return (
    <div
      className={cx('group relative my-4 overflow-hidden rounded-xl border border-line bg-code', className)}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#6b7487]">
          {lang || 'text'}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-[#9aa3b5] hover:bg-white/5 hover:text-white"
          aria-label="Sao chép code"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#d7dbe5]">
        {html ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
      </pre>
    </div>
  )
}

/** ```selfcheck block: alternating "Q: ..." / "A: ..." lines, answers hidden until revealed. */
function SelfCheck({ source }: { source: string }) {
  const items: { q: string; a: string }[] = []
  for (const line of source.split('\n')) {
    if (line.startsWith('Q:')) items.push({ q: line.slice(2).trim(), a: '' })
    else if (line.startsWith('A:') && items.length) items[items.length - 1].a = line.slice(2).trim()
  }
  return (
    <div className="my-6 rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-muted">Tự kiểm tra</div>
      <ul className="divide-y divide-line">
        {items.map((it, i) => (
          <SelfCheckItem key={i} {...it} />
        ))}
      </ul>
    </div>
  )
}

function SelfCheckItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="px-4 py-3">
      <p className="text-[14px] font-medium text-fg">
        <InlineMarkdown text={q} />
      </p>
      {open ? (
        <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-[13.5px] text-fg">
          <InlineMarkdown text={a} />
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
        >
          <Eye className="size-3.5" /> Nghĩ xong rồi — xem đáp án
        </button>
      )}
    </li>
  )
}

function components(onSeek?: (seconds: number) => void): Components {
  return {
    pre({ node }) {
      const codeEl = (node as unknown as HastNode).children?.find((c) => c.tagName === 'code')
      if (!codeEl) return null
      const cls = codeEl.properties?.className
      const lang = (Array.isArray(cls) ? cls : [cls ?? '']).join(' ').match(/language-([\w-]+)/)?.[1]
      const text = hastText(codeEl).replace(/\n$/, '')
      if (lang === 'flow') return <FlowDiagram source={text} />
      if (lang === 'selfcheck') return <SelfCheck source={text} />
      return <CodeBlock code={text} lang={lang} />
    },
    a({ href, children }) {
      const t = href?.match(/^#t=(\d+)$/)
      if (t) {
        const sec = Number(t[1])
        return (
          <button
            type="button"
            onClick={() => onSeek?.(sec)}
            disabled={!onSeek}
            className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 align-baseline text-[0.92em] font-medium text-accent hover:underline disabled:opacity-60"
            title={`Tua video tới ${formatTimestamp(sec)}`}
          >
            <PlayCircle className="size-3.5" aria-hidden />
            {children} <span className="font-mono text-[0.85em] opacity-80">{formatTimestamp(sec)}</span>
          </button>
        )
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      )
    },
    table({ children }) {
      return (
        <div className="table-wrap">
          <table>{children}</table>
        </div>
      )
    },
  }
}

export function Markdown({
  children,
  onSeek,
  className,
}: {
  children: string
  onSeek?: (seconds: number) => void
  className?: string
}) {
  return (
    <div className={cx('prose-lesson', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components(onSeek)}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Short text with inline code/bold, rendered without block wrappers (quiz prompts, options). */
export function InlineMarkdown({ text }: { text: string }): ReactNode {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ children }) => (
          <code className="rounded border border-line bg-surface-2 px-1 py-px font-mono text-[0.86em]">
            {children}
          </code>
        ),
      }}
      allowedElements={['p', 'code', 'strong', 'em']}
      unwrapDisallowed
    >
      {text}
    </ReactMarkdown>
  )
}
