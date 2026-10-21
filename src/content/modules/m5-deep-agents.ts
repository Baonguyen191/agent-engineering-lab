import type { LessonMeta } from '../types'

const DEEPAGENTS = { label: 'deepagents (LangChain)', url: 'https://github.com/langchain-ai/deepagents' }
const NB = {
  label: 'Deep Agents notebook (Google Drive, từ mô tả video)',
  url: 'https://drive.google.com/file/d/1SVjvgqvKfF-FPAIqpEZdKMQLhe13NLFD/view',
}

export const m5Lessons: LessonMeta[] = [
  {
    id: 'da-concept',
    title: 'Shallow agent vs Deep agent',
    summary: 'Vì sao vòng lặp tool đơn giản thất bại với tác vụ dài, và 4 thành phần của deep agent.',
    source: 'video',
    video: { start: 28931, end: 29940, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Giải thích hạn chế của shallow agent với tác vụ nhiều bước.',
      'Nêu 4 thành phần: planning tool, filesystem, subagent, system prompt chi tiết.',
      'Liên hệ với các sản phẩm deep research / coding agent.',
    ],
    tags: [
      'deep agent',
      'shallow agent',
      'planning',
      'todo',
      'filesystem',
      'subagent',
      'context management',
      'deep research',
    ],
    checklist: [
      'Nêu 4 thành phần của deep agent.',
      'Giải thích vì sao filesystem giúp quản lý context.',
      'Biết khi nào subagent có lợi.',
    ],
    exercises: ['deep-agent-todos'],
    references: [DEEPAGENTS, NB],
  },
  {
    id: 'da-build',
    title: 'Xây deep agent với `deepagents` + Tavily',
    summary: 'Tool tìm kiếm web, `create_deep_agent`, so sánh với `create_agent`, đọc file agent đã ghi.',
    source: 'video',
    video: { start: 29940, end: 31543, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Viết tool `internet_search` bằng Tavily.',
      'Tạo deep agent và đọc `messages` + `files` trong kết quả.',
      'Thêm subagent chuyên trách.',
    ],
    tags: ['create_deep_agent', 'Tavily', 'internet_search', 'subagents', 'write_todos', 'files'],
    checklist: [
      'Tạo được deep agent có tool tìm kiếm.',
      'Đọc được file agent ghi ra.',
      'Biết tham số `model`, `tools`, `system_prompt`, `subagents`.',
    ],
    exercises: ['deep-agent-todos'],
    references: [
      DEEPAGENTS,
      { label: 'Tavily Python SDK', url: 'https://docs.tavily.com/sdk/python/reference' },
      NB,
    ],
  },
  {
    id: 'da-patterns',
    title: 'Mẫu thiết kế: planning, context, recovery & approval',
    summary:
      'Quản lý todo, chia nhỏ tác vụ, cô lập context bằng subagent, tác vụ dài, khôi phục và phê duyệt.',
    source: 'supplement',
    studyMinutes: 30,
    objectives: [
      'Thiết kế todo list có trạng thái và phụ thuộc.',
      'Dùng filesystem/artifact để giữ context nhỏ.',
      'Thiết kế retry, checkpoint và điểm phê duyệt cho tác vụ dài.',
    ],
    tags: [
      'task decomposition',
      'todo management',
      'artifact',
      'context window',
      'long-running task',
      'checkpoint',
      'recovery',
      'approval',
    ],
    checklist: [
      'Todo có trạng thái rõ ràng.',
      'Bước lỗi không kéo sập cả kế hoạch.',
      'Có điểm duyệt trước hành động tốn kém.',
    ],
    exercises: ['deep-agent-todos'],
    references: [DEEPAGENTS],
  },
]
