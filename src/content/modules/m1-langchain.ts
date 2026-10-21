import type { LessonMeta } from '../types'

const LC_DOCS = {
  label: 'LangChain docs (Python)',
  url: 'https://docs.langchain.com/oss/python/langchain/overview',
}
const REPO = {
  label: 'Repo khóa học: Langchain-V1-Crash-Course',
  url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course',
}

export const m1Lessons: LessonMeta[] = [
  {
    id: 'lc-intro',
    title: 'Giới thiệu khóa học & môi trường làm việc',
    summary: 'Lộ trình 8 phần của khóa, cài đặt dự án bằng uv, quản lý API key bằng .env.',
    source: 'video',
    video: { start: 0, end: 1350, precision: 'transcript' },
    studyMinutes: 15,
    objectives: [
      'Nắm lộ trình khóa học và mối liên hệ giữa các phần.',
      'Tạo môi trường Python bằng `uv`, cài dependency, chọn kernel cho notebook.',
      'Nạp API key từ `.env` một cách an toàn.',
    ],
    tags: ['uv', 'virtualenv', 'dotenv', 'setup', 'jupyter'],
    checklist: [
      'Tạo được project bằng `uv init` và virtual environment `.venv`.',
      'Cài dependency từ `requirements.txt` bằng `uv add -r`.',
      'Giải thích vì sao không commit `.env` lên git.',
    ],
    references: [REPO, { label: 'uv documentation', url: 'https://docs.astral.sh/uv/' }],
  },
  {
    id: 'lc-agents',
    title: 'Từ LLM đến Agent: `create_agent` đầu tiên',
    summary: 'LLM thuần chỉ sinh text; agent = model + tools + vòng lặp ra quyết định.',
    source: 'video',
    video: { start: 1350, end: 2310, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Phân biệt LLM call đơn lẻ và agent.',
      'Tạo agent bằng `create_agent(model, tools, system_prompt)`.',
      'Đọc kết quả `agent.invoke({"messages": [...]})`.',
    ],
    tags: ['create_agent', 'agent', 'ReAct', 'tool calling', 'LangChain v1'],
    checklist: [
      'Vẽ lại được vòng lặp model → tool → model.',
      'Viết được agent tối thiểu có một tool.',
      'Biết agent dừng khi nào.',
    ],
    exercises: ['lc-agent-loop'],
    references: [REPO, LC_DOCS],
  },
  {
    id: 'lc-models',
    title: 'Model integration, streaming & batch',
    summary: '`init_chat_model` cho nhiều provider; `invoke`, `stream`, `batch` và khi nào dùng từng cái.',
    source: 'video',
    video: { start: 2310, end: 3500, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Khởi tạo model OpenAI, Gemini, Groq qua cùng một interface.',
      'Stream token để giảm thời gian chờ cảm nhận.',
      'Gửi nhiều request song song bằng `batch` và giới hạn `max_concurrency`.',
    ],
    tags: ['init_chat_model', 'ChatOpenAI', 'Groq', 'Gemini', 'stream', 'batch', 'model selection'],
    checklist: [
      'Đổi provider chỉ bằng chuỗi model, không sửa logic.',
      'Giải thích lợi ích của streaming với UX.',
      'Biết `batch` khác vòng lặp `invoke` ở điểm nào.',
    ],
    exercises: ['lc-structured-output'],
    references: [
      REPO,
      {
        label: 'init_chat_model reference',
        url: 'https://python.langchain.com/api_reference/langchain/chat_models/langchain.chat_models.base.init_chat_model.html',
      },
    ],
  },
  {
    id: 'lc-tools-messages',
    title: 'Tools & Messages',
    summary: 'Định nghĩa tool bằng `@tool`, `bind_tools`, và 4 loại message: System, Human, AI, Tool.',
    source: 'video',
    video: { start: 3500, end: 4970, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Viết tool có docstring và type hint tốt để model chọn đúng.',
      'Hiểu `tool_calls` trong `AIMessage` và `ToolMessage` trả kết quả.',
      'Dùng `SystemMessage` để đặt vai trò và ràng buộc.',
    ],
    tags: ['@tool', 'bind_tools', 'tool_calls', 'SystemMessage', 'HumanMessage', 'AIMessage', 'ToolMessage'],
    checklist: [
      'Liệt kê 4 loại message và vai trò.',
      'Giải thích vì sao ToolMessage cần `tool_call_id`.',
      'Xử lý được tool trả lỗi mà không làm sập agent.',
    ],
    exercises: ['lc-agent-loop'],
    references: [
      REPO,
      { label: 'LangChain: Tools', url: 'https://docs.langchain.com/oss/python/langchain/tools' },
    ],
  },
  {
    id: 'lc-structured',
    title: 'Structured output',
    summary:
      'Ép model trả về dữ liệu có schema bằng Pydantic, TypedDict hoặc dataclass; validate và xử lý lỗi.',
    source: 'video',
    video: { start: 4970, end: 6720, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Dùng `with_structured_output` và `response_format` trong agent.',
      'Chọn giữa Pydantic, TypedDict, dataclass, JSON schema.',
      'Thêm ràng buộc bằng `Field` và xử lý output không hợp lệ.',
    ],
    tags: [
      'with_structured_output',
      'Pydantic',
      'Field',
      'TypedDict',
      'dataclass',
      'response_format',
      'output validation',
    ],
    checklist: [
      'Viết được schema Pydantic có mô tả và ràng buộc.',
      'Biết TypedDict không validate lúc chạy.',
      'Có chiến lược retry khi model trả sai schema.',
    ],
    exercises: ['lc-structured-output', 'tp-structured-plan'],
    references: [
      REPO,
      {
        label: 'LangChain: Structured output',
        url: 'https://docs.langchain.com/oss/python/langchain/structured-output',
      },
    ],
  },
  {
    id: 'lc-middleware',
    title: 'Middleware: summarization, fallback & human-in-the-loop',
    summary:
      'Chèn logic vào vòng lặp agent: tóm tắt hội thoại dài, đổi model khi lỗi, dừng chờ người duyệt trước tool nhạy cảm.',
    source: 'video',
    video: { start: 6720, end: 9312, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Hiểu middleware chạy ở đâu trong vòng lặp agent.',
      'Cấu hình `SummarizationMiddleware` theo số message, token hoặc tỷ lệ context.',
      'Dùng `HumanInTheLoopMiddleware` với checkpointer và resume bằng `Command`.',
    ],
    tags: [
      'middleware',
      'SummarizationMiddleware',
      'HumanInTheLoopMiddleware',
      'ModelFallbackMiddleware',
      'checkpointer',
      'thread_id',
    ],
    checklist: [
      'Giải thích vì sao hội thoại dài cần tóm tắt.',
      'Cấu hình interrupt cho tool gửi email nhưng không cho tool đọc email.',
      'Biết HITL cần checkpointer và thread_id.',
    ],
    references: [
      REPO,
      { label: 'LangChain: Middleware', url: 'https://docs.langchain.com/oss/python/langchain/middleware' },
    ],
  },
]
