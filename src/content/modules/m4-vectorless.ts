import type { LessonMeta } from '../types'

const NB = {
  label: 'Notebook: PageIndex_Vectorless_RAG_CrashCourse',
  url: 'https://github.com/krishnaik06/RAG-Tutorials/blob/main/PageIndex_Vectorless_RAG_CrashCourse%20(1).ipynb',
}
const PAGEINDEX = { label: 'PageIndex (VectifyAI)', url: 'https://github.com/VectifyAI/PageIndex' }

export const m4Lessons: LessonMeta[] = [
  {
    id: 'vl-concept',
    title: 'Vectorless RAG: cây mục lục + suy luận',
    summary: 'Thay similarity search bằng việc LLM duyệt cây cấu trúc tài liệu để tìm đúng mục.',
    source: 'video',
    video: { start: 25843, end: 26760, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Nêu hạn chế của vector RAG với tài liệu dài, có cấu trúc.',
      'Giải thích tree-based indexing: node = mục/tiểu mục có tóm tắt.',
      'Mô tả reasoning-based retrieval: LLM chọn node như người đọc dùng mục lục.',
    ],
    tags: [
      'vectorless RAG',
      'tree index',
      'reasoning-based retrieval',
      'PageIndex',
      'table of contents',
      'document structure',
    ],
    checklist: [
      'Vẽ được cây của một tài liệu có heading.',
      'Giải thích vì sao chunking làm mất ngữ cảnh heading.',
      'Mô tả luồng LLM duyệt cây.',
    ],
    exercises: ['vectorless-tree'],
    references: [NB, PAGEINDEX],
  },
  {
    id: 'vl-pageindex',
    title: 'Thực hành PageIndex',
    summary: 'Gửi PDF, chờ tree được dựng, cho LLM chọn node, lấy nội dung node và sinh câu trả lời.',
    source: 'video',
    video: { start: 26760, end: 27870, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Biết các bước dùng PageIndex: API key → submit tài liệu → lấy tree → tìm node → trả lời.',
      'Viết prompt "tree search" yêu cầu LLM trả về node_id kèm lý do.',
      'Hiểu chi phí và độ trễ của việc dựng tree.',
    ],
    tags: ['PageIndex', 'tree search prompt', 'node_id', 'PDF', 'API'],
    checklist: [
      'Liệt kê các bước của luồng PageIndex.',
      'Viết được prompt tree search trả JSON.',
      'Biết tree được dựng bất đồng bộ.',
    ],
    references: [NB, PAGEINDEX],
  },
  {
    id: 'vl-compare',
    title: 'Vector RAG vs Vectorless RAG: chọn thế nào',
    summary:
      'So sánh độ chính xác, độ trễ, chi phí, quy mô và hệ sinh thái; khi nào dùng từng cách hoặc kết hợp.',
    source: 'video',
    video: { start: 27870, end: 28931, precision: 'transcript' },
    studyMinutes: 20,
    objectives: [
      'So sánh hai cách theo 6 tiêu chí.',
      'Chọn phương pháp cho các tình huống cụ thể.',
      'Thiết kế phương án kết hợp.',
    ],
    tags: ['comparison', 'latency', 'cost', 'scalability', 'hybrid', 'financial reports', 'legal documents'],
    checklist: [
      'Nêu 2 trường hợp vectorless thắng.',
      'Nêu 2 trường hợp vector thắng.',
      'Mô tả một kiến trúc kết hợp.',
    ],
    exercises: ['vectorless-tree'],
    references: [NB],
  },
]
