import { CheckCircle2, Circle, CircleDashed, Loader2, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import type { LessonStatus } from '../lib/progress/selectors'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent-strong text-white hover:bg-accent shadow-sm disabled:opacity-50',
  secondary:
    'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-raised disabled:opacity-50',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-40',
  danger:
    'bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white disabled:opacity-50',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ Badge

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ------------------------------------------------------------------ Card / Section

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">{children}</h2>
      {action}
    </div>
  )
}

// ------------------------------------------------------------------ Progress

export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  className,
  label,
}: {
  value: number
  max?: number
  tone?: 'accent' | 'success' | 'warning' | 'danger'
  className?: string
  label?: string
}) {
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const color = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[
    tone
  ]
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function StatusIcon({ status, className }: { status: LessonStatus; className?: string }) {
  if (status === 'completed')
    return <CheckCircle2 className={cx('size-4 text-success', className)} aria-label="Đã hoàn thành" />
  if (status === 'in_progress')
    return <CircleDashed className={cx('size-4 text-accent', className)} aria-label="Đang học" />
  return <Circle className={cx('size-4 text-subtle', className)} aria-label="Chưa học" />
}

// ------------------------------------------------------------------ Tabs

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = 'md',
}: {
  tabs: { id: T; label: ReactNode; count?: number }[]
  value: T
  onChange: (id: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto', className)}>
      {tabs.map((t, i) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!dir) return
              const next = (i + dir + tabs.length) % tabs.length
              onChange(tabs[next].id)
              refs.current[next]?.focus()
            }}
            className={cx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              active
                ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--line)]'
                : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  'rounded px-1 text-[11px]',
                  active ? 'bg-accent-soft text-accent' : 'text-subtle',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ Empty / error states

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 text-subtle [&>svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  const style = {
    neutral: 'border-line bg-surface-2 text-muted',
    accent: 'border-accent/30 bg-accent-soft text-fg',
    success: 'border-success/30 bg-success-soft text-fg',
    warning: 'border-warning/30 bg-warning-soft text-fg',
    danger: 'border-danger/30 bg-danger-soft text-fg',
  }[tone]
  return (
    <div className={cx('rounded-lg border px-3.5 py-2.5 text-[13.5px]', style, className)}>{children}</div>
  )
}

// ------------------------------------------------------------------ Dialog

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,440px)] rounded-xl border border-line bg-raised p-0 text-fg shadow-panel backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <IconButton label="Đóng" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="px-5 py-4 text-sm text-muted">{children}</div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <Button onClick={onClose}>Hủy</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-subtle">{hint}</div>}
    </div>
  )
}
