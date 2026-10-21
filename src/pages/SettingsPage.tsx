import { Download, KeyRound, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader } from '../components/AppShell'
import { Button, Card, ConfirmDialog, Notice, SectionTitle } from '../components/ui'
import { PROVIDER_PRESETS, isLlmConfigured, setLlmConfig, useLlmConfig } from '../lib/llmConfig'
import { dayKey } from '../lib/format'
import { exportProgress, importProgress, resetProgress, useProgress } from '../lib/progress/store'

const input =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] outline-none placeholder:text-subtle focus:border-accent'

export function SettingsPage() {
  const llm = useLlmConfig()
  const progress = useProgress((p) => p)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-lab-progress-${dayKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ tone: 'success', text: 'Đã xuất file tiến độ.' })
  }

  const counts = {
    lessons: Object.values(progress.lessons).filter((l) => l.status === 'completed').length,
    attempts: progress.quizAttempts.length,
    cards: Object.keys(progress.cards).length,
    lab: Object.keys(progress.lab).length,
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title="Cài đặt & dữ liệu" />

      <section className="mb-8">
        <SectionTitle>LLM thật cho Coding Lab</SectionTitle>
        <Card className="space-y-4 p-5">
          <p className="text-[13.5px] text-muted">
            Mặc định các bài lab dùng mock model. Để chạy với model thật, nhập endpoint tương thích OpenAI (
            <code>/chat/completions</code>). Một số provider chặn request trực tiếp từ trình duyệt (CORS); khi
            đó dùng một LiteLLM proxy chạy trên máy bạn.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                onClick={() => setLlmConfig({ baseUrl: p.baseUrl, model: p.model })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium">
              Base URL
              <input
                className={`${input} mt-1 font-mono`}
                value={llm.baseUrl}
                onChange={(e) => setLlmConfig({ baseUrl: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-medium">
              Model
              <input
                className={`${input} mt-1 font-mono`}
                value={llm.model}
                onChange={(e) => setLlmConfig({ model: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-[13px] font-medium">
            API key
            <div className="mt-1 flex gap-2">
              <input
                type="password"
                autoComplete="off"
                className={`${input} font-mono`}
                value={llm.apiKey}
                placeholder="sk-…"
                onChange={(e) => setLlmConfig({ apiKey: e.target.value })}
              />
              <Button onClick={() => setLlmConfig({ apiKey: '' })} disabled={!llm.apiKey}>
                Xóa
              </Button>
            </div>
          </label>
          <Notice tone={isLlmConfigured(llm) ? 'success' : 'neutral'}>
            <KeyRound className="mr-1.5 inline size-4" />
            API key chỉ nằm trong bộ nhớ của tab này: không ghi vào localStorage, không có trong file xuất
            tiến độ, mất khi tải lại trang.
            {isLlmConfigured(llm) ? ' Đã sẵn sàng dùng chế độ API thật.' : ''} Dùng key có giới hạn chi tiêu.
          </Notice>
        </Card>
      </section>

      <section>
        <SectionTitle>Dữ liệu học tập</SectionTitle>
        <Card className="space-y-4 p-5">
          <p className="text-[13.5px] text-muted">
            Tiến độ lưu trong trình duyệt này (localStorage). Hiện có: {counts.lessons} bài hoàn thành,{' '}
            {counts.attempts} lượt trả lời quiz, {counts.cards} mục ôn tập, {counts.lab} bài lab có code. Xuất
            file để sao lưu hoặc chuyển sang máy khác.
          </p>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="size-4" /> Xuất JSON
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Nhập JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) setPendingImport(await file.text())
              }}
            />
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <Trash2 className="size-4" /> Xóa toàn bộ tiến độ
            </Button>
          </div>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Xóa toàn bộ tiến độ?"
        confirmLabel="Xóa vĩnh viễn"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetProgress()
          setMessage({ tone: 'success', text: 'Đã xóa toàn bộ tiến độ.' })
        }}
      >
        Mọi bài đã học, kết quả quiz, lịch ôn, ghi chú và code trong lab sẽ bị xóa khỏi trình duyệt này. Không
        thể hoàn tác — hãy xuất JSON trước nếu muốn giữ bản sao.
      </ConfirmDialog>
      <ConfirmDialog
        open={pendingImport !== null}
        title="Thay tiến độ hiện tại bằng file đã chọn?"
        confirmLabel="Nhập và thay thế"
        danger
        onClose={() => setPendingImport(null)}
        onConfirm={() => {
          const err = importProgress(pendingImport ?? '')
          setMessage(
            err
              ? { tone: 'danger', text: `Không nhập được: ${err}` }
              : { tone: 'success', text: 'Đã nhập tiến độ từ file.' },
          )
        }}
      >
        Dữ liệu hiện có trong trình duyệt sẽ bị ghi đè hoàn toàn. File được kiểm tra định dạng trước khi nhập.
      </ConfirmDialog>
    </div>
  )
}
