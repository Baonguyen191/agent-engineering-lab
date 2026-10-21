import { BookOpen, Code2, LayoutDashboard, Map as MapIcon, Moon, Repeat2, Settings, Sun } from 'lucide-react'
import { Suspense, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { lessons } from '../content'
import { getLoadError, useProgress } from '../lib/progress/store'
import { Notice, ProgressBar, cx } from './ui'

const NAV = [
  { to: '/dashboard', label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
  { to: '/course', label: 'Lộ trình khóa học', short: 'Khóa học', icon: BookOpen },
  { to: '/review', label: 'Ôn tập', short: 'Ôn tập', icon: Repeat2 },
  { to: '/lab', label: 'Coding Lab', short: 'Lab', icon: Code2 },
  { to: '/projects/travel-agent', label: 'Dự án Travel Agent', short: 'Dự án', icon: MapIcon },
]

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('ael:theme', next)
    } catch {
      /* storage blocked: theme only lasts for this page */
    }
    setTheme(next)
  }
  return [theme, toggle]
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-accent-strong text-white">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path
            d="M9 22l7-12 7 12M12 18h8"
            stroke="currentColor"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[14px] font-semibold tracking-tight">Agent Engineering Lab</div>
        <div className="text-[11.5px] text-subtle">Agentic AI · Krish Naik course</div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [theme, toggleTheme] = useTheme()
  const done = useProgress((p) => lessons.filter((l) => p.lessons[l.id]?.status === 'completed').length)
  const loadError = getLoadError()

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 pb-4 pt-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Điều hướng chính">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx(
                  'flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-4', isActive && 'text-accent')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <div>
            <div className="mb-1.5 flex justify-between text-[12px] text-muted">
              <span>Hoàn thành</span>
              <span className="tabular-nums">
                {done}/{lessons.length} bài
              </span>
            </div>
            <ProgressBar value={done} max={lessons.length} label="Tiến độ khóa học" />
          </div>
          <div className="flex items-center gap-1">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cx(
                  'flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-[13px]',
                  isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Settings className="size-4" aria-hidden /> Cài đặt & dữ liệu
            </NavLink>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title="Đổi giao diện sáng/tối"
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Đổi giao diện sáng/tối"
              className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <NavLink
              to="/settings"
              aria-label="Cài đặt"
              className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2"
            >
              <Settings className="size-4" />
            </NavLink>
          </div>
        </header>

        {loadError && (
          <div className="px-4 pt-4 sm:px-6">
            <Notice tone="warning">{loadError}</Notice>
          </div>
        )}

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <Suspense
            fallback={
              <div className="grid min-h-[50vh] place-items-center text-sm text-muted" role="status">
                Đang tải trang…
              </div>
            }
          >
            {children ?? <Outlet />}
          </Suspense>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Điều hướng chính"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {NAV.map(({ to, short, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden />
              {short}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
