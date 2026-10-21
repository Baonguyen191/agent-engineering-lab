import type { LessonMeta } from '../types'

const NB = {
  label: 'Notebook: llm_gateway_tutorial.ipynb',
  url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course/blob/main/llm_gateway_tutorial.ipynb',
}
const LITELLM = { label: 'LiteLLM docs', url: 'https://docs.litellm.ai/' }

export const m8Lessons: LessonMeta[] = [
  {
    id: 'gw-concept',
    title: 'LLM Gateway là gì và giải quyết vấn đề gì',
    summary:
      'Một API thống nhất trước nhiều provider: routing, fallback, retry, rate limit, cost, caching, observability, bảo mật.',
    source: 'video',
    video: { start: 37825, end: 38730, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Nêu các vấn đề khi ứng dụng gọi trực tiếp nhiều provider.',
      'Mô tả chức năng của gateway: unified API, routing, fallback, retry, rate limit, usage/cost, caching, logging, PII.',
      'Phân biệt gateway dạng thư viện (SDK) và dạng proxy server.',
    ],
    tags: [
      'LLM gateway',
      'unified API',
      'routing',
      'fallback',
      'retry',
      'rate limiting',
      'usage tracking',
      'cost monitoring',
      'caching',
      'observability',
      'proxy',
    ],
    checklist: [
      'Liệt kê 6 chức năng của gateway.',
      'Giải thích vì sao đổi provider chỉ nên là đổi cấu hình.',
      'Biết khi nào cần proxy server.',
    ],
    exercises: ['llm-gateway'],
    references: [NB, LITELLM],
  },
  {
    id: 'gw-litellm',
    title: 'LiteLLM: completion, fallback, chi phí & Router',
    summary:
      'Gọi nhiều provider cùng một cú pháp, fallback tự động, tính cost, Router với routing strategy, dùng cùng LangChain.',
    source: 'video',
    video: { start: 38730, end: 39870, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Gọi OpenAI, Groq, Gemini bằng `litellm.completion`.',
      'Cấu hình fallback và retry.',
      'Đọc usage và tính cost cho mỗi request.',
      'Dùng `Router` với model_list, fallbacks và routing strategy.',
    ],
    tags: [
      'LiteLLM',
      'completion',
      'fallbacks',
      'num_retries',
      'completion_cost',
      'Router',
      'model_list',
      'routing_strategy',
      'LangChain',
    ],
    checklist: ['Đổi provider chỉ bằng chuỗi model.', 'Cấu hình được fallback.', 'In được token và cost.'],
    exercises: ['llm-gateway'],
    references: [NB, LITELLM, { label: 'LiteLLM Router', url: 'https://docs.litellm.ai/docs/routing' }],
  },
  {
    id: 'gw-router-pii',
    title: 'Smart router, che PII & observability',
    summary:
      'Phân loại tác vụ để chọn model phù hợp, che dữ liệu nhạy cảm trước khi gửi provider, ghi log/trace an toàn.',
    source: 'video',
    video: { start: 39870, end: 40405, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Thiết kế smart router theo loại tác vụ và chi phí.',
      'Che PII bằng regex trước khi request rời hệ thống.',
      'Ghi log/trace có cấu trúc, không lộ secret.',
    ],
    tags: [
      'smart router',
      'task classification',
      'PII masking',
      'regex',
      'observability',
      'tracing',
      'logging',
      'budget',
    ],
    checklist: [
      'Router có nhánh mặc định.',
      'PII được che trước khi gọi provider.',
      'Log có model, token, cost, latency, không có secret.',
    ],
    exercises: ['llm-gateway', 'tp-tracing'],
    references: [NB, LITELLM],
  },
]
