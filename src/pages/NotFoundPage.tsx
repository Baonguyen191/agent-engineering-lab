import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/ui'

export function NotFoundPage({ what = 'Trang' }: { what?: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={<Compass />}
        title={`${what} không tồn tại`}
        action={
          <Link to="/dashboard" className="text-sm font-medium text-accent hover:underline">
            Về trang tổng quan
          </Link>
        }
      >
        Đường dẫn có thể đã thay đổi. Hãy chọn bài học từ lộ trình khóa học.
      </EmptyState>
    </div>
  )
}
