import type { Module } from './types'

/**
 * Video facts. Chapter timestamps are copied from the official video description
 * (fetched 2026-10-21); duration from the YouTube player metadata (40405 s).
 */
export const VIDEO = {
  id: 'rV3HJ4LEZ7k',
  url: 'https://www.youtube.com/watch?v=rV3HJ4LEZ7k',
  title:
    'Complete Agentic AI Course In 10 Hours — LangChain, LangGraph, RAG, Vectorless RAG, Guardrails, Evals',
  instructor: 'Krish Naik',
  durationSeconds: 40405,
  chapters: [
    { start: 0, title: 'Introduction' },
    { start: 151, title: 'Langchain Course' },
    { start: 9312, title: 'Langraph Course' },
    { start: 18149, title: 'RAG Course' },
    { start: 25843, title: 'Vectorless RAG' },
    { start: 28931, title: 'Deep Agents' },
    { start: 31543, title: 'Guardrails' },
    { start: 33775, title: 'LLM Evaluation' },
    { start: 37825, title: 'LLM Gateways' },
  ],
} as const

export const SOURCE_NOTE =
  'Timestamp chương lấy từ mô tả chính thức của video. Timestamp từng bài được xác định bằng cách tìm từ khóa trong transcript tự động (ASR) của YouTube nên có thể lệch khoảng ±1 phút. Phần giải thích, ví dụ, quiz và bài tập do ứng dụng này biên soạn — không phải lời giảng nguyên văn.'

export const modules: Module[] = [
  {
    id: 'm1',
    index: 1,
    title: 'LangChain & LLM Engineering',
    shortTitle: 'LangChain',
    description:
      'Gọi chat model qua một interface thống nhất, dùng tool calling, messages, structured output và middleware của LangChain v1 để xây agent đầu tiên.',
    goals: [
      'Khởi tạo model của nhiều provider bằng `init_chat_model` và biết khi nào dùng `invoke`, `stream`, `batch`.',
      'Định nghĩa tool, hiểu vòng lặp agent và vai trò của từng loại message.',
      'Ép model trả về structured output và validate kết quả.',
      'Dùng middleware (summarization, human-in-the-loop, fallback) để kiểm soát agent.',
    ],
    prerequisites: [
      'Python 3.10+',
      'Biết gọi một LLM API (OpenAI/Groq/Gemini)',
      'Biến môi trường và file `.env`',
    ],
    // Includes the 2.5-minute course introduction (0:00) that precedes the LangChain chapter (2:31).
    video: { start: 0, end: 9312, precision: 'official' },
    repo: {
      label: 'Langchain-V1-Crash-Course',
      url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course',
    },
    miniProject: {
      title: 'Agent có 3 tool chịu được lỗi',
      brief: 'Hoàn thành bài lab `lc-agent-loop` và giai đoạn 1–2 của Travel Planning Agent.',
      stageIds: ['stage-1', 'stage-2'],
    },
  },
  {
    id: 'm2',
    index: 2,
    title: 'LangGraph — Workflow & Agent có trạng thái',
    shortTitle: 'LangGraph',
    description:
      'Mô hình hóa ứng dụng LLM thành graph gồm state, node, edge; thêm tool, memory, streaming, human-in-the-loop và MCP.',
    goals: [
      'Thiết kế state schema và reducer phù hợp.',
      'Xây chatbot, ReAct agent với `ToolNode` và `tools_condition`.',
      'Lưu trạng thái theo `thread_id` bằng checkpointer, stream theo `values`/`updates`.',
      'Tạm dừng graph bằng `interrupt()` và resume bằng `Command`.',
      'Kết nối tool từ MCP server vào agent.',
    ],
    prerequisites: ['Module 1', 'TypedDict / type hints trong Python'],
    video: { start: 9312, end: 18149, precision: 'official' },
    repo: {
      label: 'Agentic-LanggraphCrash-course',
      url: 'https://github.com/krishnaik06/Agentic-LanggraphCrash-course',
    },
    miniProject: {
      title: 'Workflow đặt phòng có duyệt thủ công',
      brief: 'Bài lab `lg-approval-workflow` và giai đoạn 4–5 của Travel Planning Agent.',
      stageIds: ['stage-4', 'stage-5'],
    },
  },
  {
    id: 'm3',
    index: 3,
    title: 'RAG — Retrieval-Augmented Generation',
    shortTitle: 'RAG',
    description:
      'Xây pipeline RAG từ đầu: ingestion, parsing, chunking, embedding, vector store, retrieval và generation có trích dẫn; sau đó là các kỹ thuật nâng cao.',
    goals: [
      'Giải thích kiến trúc RAG và lý do cần nó.',
      'Load tài liệu thành `Document` có metadata, chunk hợp lý.',
      'Sinh embedding, lưu vào vector store và truy xuất theo similarity.',
      'Trả lời có nguồn, biết từ chối khi thiếu bằng chứng.',
      'Biết khi nào cần hybrid retrieval, reranking, query transformation.',
    ],
    prerequisites: ['Module 1', 'Khái niệm vector và cosine similarity'],
    video: { start: 18149, end: 25843, precision: 'official' },
    repo: { label: 'RAG-Tutorials', url: 'https://github.com/krishnaik06/RAG-Tutorials' },
    miniProject: {
      title: 'Mini-RAG hướng dẫn du lịch',
      brief: 'Bài lab `rag-chunking`, `rag-mini` và giai đoạn 3 của Travel Planning Agent.',
      stageIds: ['stage-3'],
    },
  },
  {
    id: 'm4',
    index: 4,
    title: 'Vectorless RAG',
    shortTitle: 'Vectorless RAG',
    description:
      'Truy xuất dựa trên cấu trúc tài liệu (cây mục lục) và khả năng suy luận của LLM thay vì vector similarity — cách tiếp cận của PageIndex.',
    goals: [
      'Giải thích tree-based indexing và reasoning-based retrieval.',
      'Biết luồng dùng PageIndex: gửi tài liệu → nhận tree → tìm node → sinh câu trả lời.',
      'So sánh chi phí, độ trễ, độ chính xác với vector RAG và chọn đúng cho từng bài toán.',
    ],
    prerequisites: ['Module 3'],
    video: { start: 25843, end: 28931, precision: 'official' },
    repo: {
      label: 'PageIndex_Vectorless_RAG_CrashCourse.ipynb',
      url: 'https://github.com/krishnaik06/RAG-Tutorials/blob/main/PageIndex_Vectorless_RAG_CrashCourse%20(1).ipynb',
    },
    miniProject: {
      title: 'So sánh tree retrieval và flat retrieval',
      brief: 'Bài lab `vectorless-tree`.',
      stageIds: [],
    },
  },
  {
    id: 'm5',
    index: 5,
    title: 'Deep Agents',
    shortTitle: 'Deep Agents',
    description:
      'Agent cho tác vụ dài và phức tạp: lập kế hoạch bằng todo, dùng filesystem làm bộ nhớ ngoài, giao việc cho subagent.',
    goals: [
      'Phân biệt shallow agent (vòng lặp tool đơn giản) với deep agent.',
      'Tạo deep agent với thư viện `deepagents` và tool tìm kiếm web.',
      'Áp dụng planning, context management, subagent, recovery.',
    ],
    prerequisites: ['Module 1–2'],
    video: { start: 28931, end: 31543, precision: 'official' },
    repo: {
      label: 'Deep Agents notebook (Google Drive, từ mô tả video)',
      url: 'https://drive.google.com/file/d/1SVjvgqvKfF-FPAIqpEZdKMQLhe13NLFD/view',
    },
    miniProject: {
      title: 'Agent lập kế hoạch nhiều bước',
      brief: 'Bài lab `deep-agent-todos` và giai đoạn 6 của Travel Planning Agent.',
      stageIds: ['stage-6'],
    },
  },
  {
    id: 'm6',
    index: 6,
    title: 'Guardrails & Agent Security',
    shortTitle: 'Guardrails',
    description:
      'Kiểm soát đầu vào, đầu ra và hành động của agent: guardrail deterministic và model-based, PII, human-in-the-loop, hook trước/sau agent, prompt injection.',
    goals: [
      'Chọn guardrail deterministic hay model-based theo chi phí và độ chính xác.',
      'Dùng `PIIMiddleware`, `HumanInTheLoopMiddleware` và custom middleware.',
      'Phòng thủ prompt injection, nội dung truy xuất không tin cậy, phân quyền tool.',
    ],
    prerequisites: ['Module 1 (middleware)', 'Module 2 (interrupt)'],
    video: { start: 31543, end: 33775, precision: 'official' },
    repo: {
      label: 'langchain_guardrails_crash_course.ipynb',
      url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course/blob/main/updatedlangchain/langchain_guardrails_crash_course.ipynb',
    },
    miniProject: {
      title: 'Red-team agent du lịch',
      brief: 'Bài lab `guardrails` và giai đoạn 7 của Travel Planning Agent.',
      stageIds: ['stage-7'],
    },
  },
  {
    id: 'm7',
    index: 7,
    title: 'LLM Evaluation',
    shortTitle: 'Evaluation',
    description:
      'Đo chất lượng ứng dụng LLM bằng dataset, evaluator (rule-based và LLM-as-a-judge) và experiment trên LangSmith; đánh giá riêng cho RAG và agent.',
    goals: [
      'Tạo dataset golden test case và chạy experiment.',
      'Viết evaluator correctness / concision và LLM-as-a-judge.',
      'Đánh giá RAG: correctness, relevance, groundedness, retrieval relevance.',
      'Đo tool selection accuracy, task success, regression.',
    ],
    prerequisites: ['Module 1, 3'],
    video: { start: 33775, end: 37825, precision: 'official' },
    repo: {
      label: '1-rag_evaluation.ipynb',
      url: 'https://github.com/krishnaik06/RAG-Tutorials/blob/main/1-rag_evaluation.ipynb',
    },
    miniProject: {
      title: 'Bộ test 20 case cho travel agent',
      brief: 'Bài lab `eval-harness` và giai đoạn 8 của Travel Planning Agent.',
      stageIds: ['stage-8'],
    },
  },
  {
    id: 'm8',
    index: 8,
    title: 'LLM Gateways',
    shortTitle: 'Gateways',
    description:
      'Một API thống nhất đứng trước nhiều provider: routing, fallback, retry, rate limit, theo dõi chi phí, caching và observability — thực hành với LiteLLM.',
    goals: [
      'Giải thích vấn đề mà gateway giải quyết.',
      'Dùng LiteLLM `completion` và `Router` với fallback, theo dõi cost.',
      'Thiết kế smart router theo loại tác vụ và che PII trước khi gửi model.',
    ],
    prerequisites: ['Module 1'],
    video: { start: 37825, end: 40405, precision: 'official' },
    repo: {
      label: 'llm_gateway_tutorial.ipynb',
      url: 'https://github.com/krishnaik06/Langchain-V1-Crash-Course/blob/main/llm_gateway_tutorial.ipynb',
    },
    miniProject: {
      title: 'Gateway có fallback và log usage',
      brief: 'Bài lab `llm-gateway` và giai đoạn 9–10 của Travel Planning Agent.',
      stageIds: ['stage-9', 'stage-10'],
    },
  },
]
