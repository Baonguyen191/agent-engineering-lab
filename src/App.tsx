import { lazy, useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from './components/AppShell'
import { NotFoundPage } from './pages/NotFoundPage'

// Route-level code splitting: each page loads on first visit.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const CoursePage = page(() => import('./pages/CoursePage'), 'CoursePage')
const LearnPage = page(() => import('./pages/LearnPage'), 'LearnPage')
const ReviewPage = page(() => import('./pages/ReviewPage'), 'ReviewPage')
const LabPage = page(() => import('./pages/LabPage'), 'LabPage')
const ExercisePage = page(() => import('./pages/LabPage'), 'ExercisePage')
const ProjectPage = page(() => import('./pages/ProjectPage'), 'ProjectPage')
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage')

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, 'Tổng quan'],
  [/^\/course/, 'Lộ trình khóa học'],
  [/^\/learn/, 'Bài học'],
  [/^\/review/, 'Ôn tập'],
  [/^\/lab/, 'Coding Lab'],
  [/^\/projects/, 'Dự án Travel Agent'],
  [/^\/settings/, 'Cài đặt'],
]

function useDocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1]
    document.title = t ? `${t} · Agent Engineering Lab` : 'Agent Engineering Lab'
    if (!pathname.startsWith('/learn')) window.scrollTo(0, 0)
  }, [pathname])
}

export default function App() {
  useDocumentTitle()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="course" element={<CoursePage />} />
        <Route path="learn/:lessonId" element={<LearnPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="lab/:exerciseId" element={<ExercisePage />} />
        <Route path="projects/travel-agent" element={<ProjectPage />} />
        <Route path="projects/travel-agent/:stageId" element={<ProjectPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
