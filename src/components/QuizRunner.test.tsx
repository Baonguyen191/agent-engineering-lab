import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Question } from '../content/types'
import { emptyProgress } from '../lib/progress/schema'
import { __setTestState, getProgress } from '../lib/progress/store'
import { QuizRunner } from './QuizRunner'

const questions: Question[] = [
  {
    id: 't-q1',
    lessonId: 'lc-agents',
    kind: 'concept',
    type: 'single',
    prompt: 'Agent dừng khi nào?',
    options: ['Có ToolMessage', 'AIMessage không còn tool_calls'],
    answer: 1,
    explanation: 'Không còn tool call.',
    whyNot: ['ToolMessage là đầu vào cho lượt sau.', ''],
  },
  {
    id: 't-q2',
    lessonId: 'lc-agents',
    kind: 'terminology',
    type: 'fill',
    prompt: 'Hàm khởi tạo model?',
    accept: ['init_chat_model'],
    explanation: 'init_chat_model.',
  },
]

const renderQuiz = () =>
  render(
    <MemoryRouter>
      <QuizRunner questions={questions} />
    </MemoryRouter>,
  )

beforeEach(() => __setTestState(emptyProgress(), () => new Date('2026-10-21T10:00:00')))

describe('QuizRunner', () => {
  it('cannot submit before answering', () => {
    renderQuiz()
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled()
  })

  it('grades a wrong answer, explains why, records it and queues it for review', async () => {
    const user = userEvent.setup()
    renderQuiz()
    await user.click(screen.getByRole('button', { name: /Có ToolMessage/ }))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByText('Chưa đúng')).toBeInTheDocument()
    expect(screen.getByText(/ToolMessage là đầu vào cho lượt sau/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ôn lại/ })).toHaveAttribute('href', '/learn/lc-agents')
    expect(getProgress().quizAttempts).toEqual([
      expect.objectContaining({ questionId: 't-q1', correct: false }),
    ])
    expect(getProgress().cards['q:t-q1']).toBeDefined()
  })

  it('runs to a summary and offers to retry wrong answers', async () => {
    const user = userEvent.setup()
    renderQuiz()
    await user.click(screen.getByRole('button', { name: /AIMessage không còn/ }))
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByText('Chính xác')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    await user.type(screen.getByLabelText('Câu trả lời'), 'init_model{Enter}')
    expect(screen.getByText('Chưa đúng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem kết quả' }))
    expect(screen.getByText('1/2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Làm lại 1 câu sai/ }))
    expect(screen.getByText('Hàm khởi tạo model?')).toBeInTheDocument()
  })
})
