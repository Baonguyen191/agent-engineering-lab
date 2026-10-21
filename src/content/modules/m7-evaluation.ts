import type { LessonMeta } from '../types'

const NB = {
  label: 'Notebook: 1-rag_evaluation.ipynb',
  url: 'https://github.com/krishnaik06/RAG-Tutorials/blob/main/1-rag_evaluation.ipynb',
}
const LS = { label: 'LangSmith: Evaluation', url: 'https://docs.smith.langchain.com/evaluation' }

export const m7Lessons: LessonMeta[] = [
  {
    id: 'ev-concept',
    title: 'Vì sao phải đánh giá ứng dụng LLM & LLM-as-a-judge',
    summary:
      'Output không xác định, "trông ổn" không phải bằng chứng; quy trình dataset → chạy → chấm → so sánh.',
    source: 'video',
    video: { start: 33775, end: 34540, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Giải thích vì sao cần evaluation có hệ thống cho ứng dụng LLM.',
      'Mô tả quy trình: thu thập data point → định nghĩa metric → chạy → so sánh.',
      'Biết khi nào dùng rule-based và khi nào dùng LLM-as-a-judge.',
    ],
    tags: [
      'evaluation',
      'LLM-as-a-judge',
      'golden dataset',
      'exact match',
      'rule-based evaluation',
      'metrics',
    ],
    checklist: [
      'Nêu 3 loại evaluator.',
      'Biết điểm yếu của LLM-as-a-judge.',
      'Viết được một golden test case.',
    ],
    exercises: ['eval-harness'],
    references: [NB, LS],
  },
  {
    id: 'ev-langsmith',
    title: 'Dataset, evaluator & experiment trên LangSmith',
    summary:
      'Tạo dataset, viết evaluator correctness / concision, chạy `client.evaluate` và so sánh experiment.',
    source: 'video',
    video: { start: 34540, end: 35910, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Tạo dataset và example bằng LangSmith SDK.',
      'Viết evaluator dạng hàm (rule) và dạng LLM judge có structured output.',
      'Chạy experiment, so sánh hai phiên bản ứng dụng.',
    ],
    tags: [
      'LangSmith',
      'Client',
      'create_dataset',
      'create_examples',
      'evaluate',
      'experiment',
      'correctness',
      'concision',
      'wrap_openai',
    ],
    checklist: [
      'Tạo được dataset có inputs/outputs.',
      'Viết evaluator trả bool/điểm.',
      'So sánh 2 experiment theo từng example.',
    ],
    exercises: ['eval-harness'],
    references: [NB, LS],
  },
  {
    id: 'ev-rag',
    title: 'Đánh giá RAG: correctness, relevance, groundedness, retrieval relevance',
    summary:
      'Bốn evaluator so sánh các cặp khác nhau giữa câu hỏi, câu trả lời, tài liệu truy xuất và đáp án chuẩn.',
    source: 'video',
    video: { start: 35910, end: 37825, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Phân biệt 4 evaluator RAG và cặp dữ liệu mỗi cái so sánh.',
      'Viết prompt LLM judge với rubric rõ ràng.',
      'Dùng kết quả để xác định lỗi nằm ở retrieval hay generation.',
    ],
    tags: [
      'RAG evaluation',
      'correctness',
      'relevance',
      'groundedness',
      'retrieval relevance',
      'hallucination',
      'reference answer',
    ],
    checklist: [
      'Vẽ bảng 4 evaluator.',
      'Biết evaluator nào không cần reference.',
      'Chẩn đoán được lỗi từ điểm số.',
    ],
    references: [NB, LS],
  },
  {
    id: 'ev-agent',
    title: 'Đánh giá agent: tool selection, task success, latency, cost & regression',
    summary: 'Metric riêng cho agent, đo chi phí/độ trễ, và đưa evaluation vào quy trình phát hành.',
    source: 'supplement',
    studyMinutes: 30,
    objectives: [
      'Đo tool selection accuracy và task success rate.',
      'Theo dõi latency (p50/p95) và cost theo phiên bản.',
      'Phát hiện regression theo từng case, không chỉ theo điểm tổng.',
    ],
    tags: [
      'tool selection accuracy',
      'task success rate',
      'trajectory evaluation',
      'latency',
      'cost',
      'regression testing',
      'CI',
    ],
    checklist: ['Bộ test có case không cần tool.', 'So sánh theo từng case.', 'Có ngưỡng chặn phát hành.'],
    exercises: ['eval-harness'],
    references: [LS],
  },
]
