import type { LessonMeta } from '../types'

const NB = {
  label: 'Notebook: langchain_guardrails_crash_course.ipynb',
  url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course/blob/main/updatedlangchain/langchain_guardrails_crash_course.ipynb',
}
const DOCS = {
  label: 'LangChain: Guardrails',
  url: 'https://docs.langchain.com/oss/python/langchain/guardrails',
}

export const m6Lessons: LessonMeta[] = [
  {
    id: 'gr-concept',
    title: 'Guardrails: deterministic vs model-based, và vị trí đặt chúng',
    summary: 'Hai cách tiếp cận guardrail và các điểm can thiệp trong vòng lặp agent qua middleware.',
    source: 'video',
    video: { start: 31543, end: 32460, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'So sánh guardrail deterministic (rule) và model-based (LLM đánh giá).',
      'Xác định điểm đặt guardrail: before agent, before/after model, quanh tool, after agent.',
      'Hiểu defense in depth.',
    ],
    tags: [
      'guardrails',
      'deterministic',
      'model-based',
      'middleware',
      'before_agent',
      'after_agent',
      'defense in depth',
    ],
    checklist: [
      'Nêu ưu nhược của hai loại guardrail.',
      'Vẽ được các điểm hook trong vòng lặp agent.',
      'Giải thích defense in depth.',
    ],
    exercises: ['guardrails'],
    references: [NB, DOCS],
  },
  {
    id: 'gr-pii',
    title: 'Guardrail deterministic & PII middleware',
    summary:
      'Chặn từ khóa/chủ đề cấm bằng rule; phát hiện và xử lý PII bằng `PIIMiddleware` (redact, mask, hash, block).',
    source: 'video',
    video: { start: 32460, end: 33210, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Viết hàm guardrail deterministic trả về bool.',
      'Cấu hình `PIIMiddleware` cho email, thẻ tín dụng và PII tùy chỉnh.',
      'Chọn chiến lược redact / mask / hash / block phù hợp.',
    ],
    tags: [
      'PII',
      'PIIMiddleware',
      'redact',
      'mask',
      'hash',
      'block',
      'apply_to_input',
      'regex',
      'sensitive data',
    ],
    checklist: [
      'Viết được regex cho email và số điện thoại.',
      'Biết khi nào dùng block thay vì redact.',
      'Không để PII lọt vào log.',
    ],
    exercises: ['guardrails'],
    references: [NB, DOCS],
  },
  {
    id: 'gr-hitl-custom',
    title: 'Human approval, custom guardrail & kiểm tra output',
    summary:
      '`HumanInTheLoopMiddleware` cho tool nhạy cảm, custom `before_agent` / `after_agent` hook, kiểm tra an toàn output bằng model.',
    source: 'video',
    video: { start: 33210, end: 33775, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Cấu hình duyệt thủ công cho tool gửi email / xóa dữ liệu.',
      'Viết custom middleware `before_agent` chặn sớm và `after_agent` kiểm tra kết quả.',
      'Dùng LLM làm bộ phân loại an toàn cho output.',
    ],
    tags: [
      'HumanInTheLoopMiddleware',
      'before_agent',
      'after_agent',
      'custom middleware',
      'jump_to',
      'output validation',
      'safe failure',
    ],
    checklist: [
      'Viết được hook before_agent dừng sớm bằng jump_to.',
      'Biết khi nào kiểm tra output.',
      'Thiết kế thông báo từ chối an toàn.',
    ],
    exercises: ['guardrails'],
    references: [NB, DOCS],
  },
  {
    id: 'gr-injection',
    title: 'Prompt injection, nội dung không tin cậy & phân quyền tool',
    summary:
      'Tấn công trực tiếp và gián tiếp, least privilege, cách ly dữ liệu, safe failure và kiểm thử đỏ (red teaming).',
    source: 'supplement',
    studyMinutes: 35,
    objectives: [
      'Phân biệt direct và indirect prompt injection.',
      'Coi nội dung truy xuất/tool output là dữ liệu, không phải chỉ dẫn.',
      'Áp dụng least privilege và phê duyệt cho tool.',
      'Xây bộ test tấn công cho agent.',
    ],
    tags: [
      'prompt injection',
      'indirect prompt injection',
      'untrusted content',
      'least privilege',
      'tool permissions',
      'red teaming',
      'data exfiltration',
    ],
    checklist: [
      'Giải thích vì sao system prompt không đủ chống injection.',
      'Thiết kế quyền tool theo vai trò.',
      'Có ít nhất 5 test tấn công.',
    ],
    exercises: ['guardrails'],
    references: [
      { label: 'OWASP Top 10 for LLM Applications', url: 'https://genai.owasp.org/llm-top-10/' },
      DOCS,
    ],
  },
]
