# Agent Engineering Lab

Nền tảng học tập tương tác cho khóa **Complete Agentic AI Course In 10 Hours** của Krish Naik
([video gốc](https://www.youtube.com/watch?v=rV3HJ4LEZ7k)): 8 module, 35 bài học, video nhúng mở đúng
timestamp, quiz chấm điểm, flashcard với spaced repetition, Coding Lab chạy Python thật trong trình duyệt và
dự án Travel Planning Agent 10 giai đoạn.

Giao diện tiếng Việt, code và thuật ngữ tiếng Anh.

## Chạy dự án

Yêu cầu: Node.js 20+ (đã thử với Node 24), Python 3.11+ (chỉ để chạy script kiểm chứng bài tập).

```bash
npm install
npm run dev          # http://localhost:5173
```

Build bản production:

```bash
npm run build        # type check + build vào dist/
npm run preview      # phục vụ dist/ tại http://localhost:4173
```

Ứng dụng là SPA tĩnh: có thể deploy `dist/` lên bất kỳ static host nào, miễn là mọi đường dẫn được rewrite về
`index.html`.

Lần đầu mở Coding Lab, trình duyệt tải Pyodide (~10 MB) từ `cdn.jsdelivr.net`; các lần sau dùng cache.

## Kiểm tra chất lượng

| Lệnh | Việc làm |
|---|---|
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier |
| `npm test` | Vitest: tính toàn vẹn nội dung, chấm quiz, Leitner, selectors, store, component QuizRunner |
| `npm run verify:python` | Chạy mọi bài tập bằng CPython: lời giải phải qua 100% test, code khởi đầu phải trượt ít nhất 1 test |

## Các trang

| Route | Nội dung |
|---|---|
| `/dashboard` | Tiến độ, video đã học, chuỗi ngày học, độ chính xác quiz, chủ đề yếu, lịch ôn 7 ngày, gợi ý việc tiếp theo |
| `/course` | Lộ trình 8 module, tìm kiếm (không dấu cũng được), lọc chưa học / đang học / hoàn thành / cần ôn |
| `/learn/:lessonId` | Workspace: mục lục, video YouTube + bài giảng, panel luyện tập (quiz, flashcard, lab, checklist, ghi chú) |
| `/review` | Mục đến hạn, flashcard, quiz theo module, quiz tổng hợp, câu đã sai, thống kê |
| `/lab`, `/lab/:exerciseId` | 11 bài lab theo module: editor, Chạy, Chạy test, Reset, gợi ý từng bước, lời giải |
| `/projects/travel-agent/:stageId` | 10 giai đoạn dự án, mỗi giai đoạn có bài chạy được trong trình duyệt + code stack thật |
| `/settings` | Cấu hình LLM thật, xuất / nhập / xóa tiến độ |

## Kiến trúc

```
src/
  content/                 # toàn bộ nội dung là dữ liệu, tách khỏi UI
    course.ts              # thông tin video, 8 module
    modules/m*.ts|.md      # metadata bài học (.ts) + nội dung bài (.md, tách bằng <!-- lesson: id -->)
    bank/m*.ts             # ngân hàng câu hỏi + flashcard
    exercises.ts           # metadata bài lab; code nằm trong python/exercises/*.py
    project.ts             # 10 giai đoạn Travel Planning Agent
    python/labkit/         # thư viện Python nhỏ dùng trong lab (mock LLM, mini StateGraph, toy embedding, test runner)
    validate.ts            # kiểm tra tính toàn vẹn nội dung (chạy trong test)
  lib/
    progress/              # schema (zod), store (localStorage), Leitner, selectors cho dashboard
    quiz/grade.ts          # chấm điểm 5 dạng câu hỏi
    python/                # Pyodide Web Worker + runner có timeout
    youtube.ts, llmConfig.ts, search.ts, format.ts
  components/              # AppShell, Markdown (+ sơ đồ flow, self-check), QuizRunner, FlashcardDeck,
                           # ExerciseWorkbench, CodeEditor (CodeMirror 6), YouTubePlayer, ui primitives
  pages/                   # mỗi route một file, tải lazy
scripts/verify_exercises.py
```

Stack: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, React Router 7, CodeMirror 6, react-markdown,
highlight.js, zod, Pyodide 0.28.3, Vitest + Testing Library.

Không có backend: phiên bản cá nhân lưu tiến độ trong `localStorage` (khóa `ael:progress:v1`) với schema được
validate khi đọc/nhập; có xuất/nhập JSON.

## Nguồn nội dung và mức độ chính xác

- Mốc chương của 8 module lấy từ **mô tả chính thức** của video.
- Mốc từng bài được xác định bằng cách tìm từ khóa trong **transcript tự động (ASR)** của YouTube, có thể lệch
  khoảng ±1 phút; giao diện ghi rõ điều này ở mỗi bài.
- Phần giải thích, ví dụ, quiz, flashcard và bài tập do ứng dụng biên soạn, **không phải lời giảng nguyên văn**.
- 5 bài được đánh dấu **"Tài liệu bổ sung"** (LangGraph nâng cao, RAG nâng cao, mẫu thiết kế deep agent, prompt
  injection, đánh giá agent) vì video không đi sâu vào các chủ đề đó; các bài này không gắn timestamp video.
- Code dùng thư viện thật (LangChain 1.x, LangGraph 1.x, deepagents, LiteLLM, LangSmith) được viết theo API công
  khai tại thời điểm biên soạn. API của các thư viện này thay đổi nhanh — đối chiếu tài liệu chính thức với phiên
  bản bạn cài.

## Coding Lab: cái gì chạy thật, cái gì là mô phỏng

- **Python chạy thật**: CPython (Pyodide/WebAssembly) trong một Web Worker, cô lập khỏi trang. Mỗi lần chạy có
  giới hạn 15 giây (90 giây khi gọi API thật); quá giờ thì worker bị hủy và tạo lại.
- **Test chạy thật**: kết quả đạt/trượt là kết quả thực thi `tests.py` trên code của bạn.
- **LLM mặc định là mock** (`labkit.llm.MockChatModel`): trả lời theo rule/script cố định, không hiểu ngôn ngữ. Lý
  do: chạy miễn phí, không cần key, kết quả ổn định để chấm. Giao diện luôn ghi rõ chế độ đang dùng.
- **LLM thật (tùy chọn)**: nhập endpoint tương thích OpenAI (OpenAI, Groq, OpenRouter, LiteLLM proxy) ở
  `/settings`. Nút **Chạy** của các bài có nhãn "Mock / API thật" sẽ gọi API thật; **Chạy test luôn dùng mock**.
  API key chỉ nằm trong bộ nhớ tab (không lưu localStorage, không có trong file xuất). Một số provider chặn gọi
  trực tiếp từ trình duyệt (CORS) — khi đó chạy LiteLLM proxy trên máy.
- **`labkit.graph` là bản thu nhỏ do ứng dụng viết** mô phỏng API của LangGraph (state, reducer, conditional
  edge, chạy song song, checkpoint, `interrupt`/`Command`). Nó không phải LangGraph thật; code cho stack thật nằm
  trong mục "Chạy với stack thật" của từng giai đoạn dự án và không được chạy trong trình duyệt.
- `labkit.rag.embed` là embedding bag-of-words (toy), không phải neural embedding.

## Hạn chế đã biết

- Tiến độ chỉ nằm trong trình duyệt hiện tại; muốn đồng bộ giữa máy dùng xuất/nhập JSON.
- Lần đầu chạy lab cần mạng để tải Pyodide từ CDN.
- Thời lượng "đã xem trong app" chỉ đếm khi video phát trong trang (YouTube IFrame API, cập nhật mỗi 5 giây).
- Mock LLM không thay được model thật về chất lượng câu trả lời; nó dùng để học luồng xử lý và kiểm thử.
