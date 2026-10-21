import type { Exercise } from './types'

/**
 * Exercise code lives in real .py files (so scripts/verify_exercises.py can run it with CPython).
 * Each file holds several exercises separated by "# @@<id>:<starter|solution|tests>" lines.
 */
const exerciseFiles = import.meta.glob('./python/exercises/*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const labkitSources = import.meta.glob('./python/labkit/*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** labkit package files, written into the Pyodide filesystem before each run. */
export const labkitFiles = Object.entries(labkitSources).map(([path, code]) => ({
  name: path.split('/').pop() as string,
  code,
}))

type Section = 'starter' | 'solution' | 'tests'

/** Same parsing rules as split_sections() in scripts/verify_exercises.py. */
export function parseExerciseFile(text: string): Record<string, Partial<Record<Section, string>>> {
  const out: Record<string, Partial<Record<Section, string[]>>> = {}
  let current: string[] | null = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('# @@')) {
      const [id, section] = line.slice(4).trim().split(':') as [string, Section]
      current = (out[id] ??= {})[section] = []
    } else if (current) {
      current.push(line)
    }
  }
  const result: Record<string, Partial<Record<Section, string>>> = {}
  for (const [id, sections] of Object.entries(out)) {
    result[id] = {}
    for (const [name, lines] of Object.entries(sections)) {
      result[id][name as Section] = lines!.join('\n').trim() + '\n'
    }
  }
  return result
}

const sources: Record<string, Partial<Record<Section, string>>> = Object.assign(
  {},
  ...Object.values(exerciseFiles).map(parseExerciseFile),
)

type ExerciseMeta = Omit<Exercise, 'starter' | 'solution' | 'tests'>

const META: ExerciseMeta[] = [
  {
    id: 'lc-structured-output',
    title: 'Structured output có validate và retry',
    moduleId: 'm1',
    lessonIds: ['lc-structured', 'lc-models'],
    difficulty: 'medium',
    brief:
      'LLM trả về text, còn ứng dụng cần **dữ liệu có kiểu**. Hãy viết lớp xử lý giữa hai bên: trích JSON từ câu trả lời, validate từng trường, và khi model trả sai thì gửi lỗi lại để model tự sửa — đúng cơ chế mà `with_structured_output` / `response_format` của LangChain làm giúp bạn.',
    requirements: [
      '`extract_json` đọc JSON thuần, JSON lẫn trong câu chữ và khối ```json; không có JSON object hợp lệ thì raise `ValueError`.',
      '`parse_trip_request` kiểm tra từng trường, thông báo lỗi phải nêu tên trường sai (bool không được coi là int).',
      '`extract_with_retry` gửi lỗi validate lại cho model và thử tối đa `max_retries + 1` lần.',
    ],
    hints: [
      'Tìm khối fenced trước bằng regex `r"```(?:json)?\\s*(\\{.*?\\})\\s*```"` với cờ `re.S`; nếu không có thì lấy từ `{` đầu tiên tới `}` cuối cùng.',
      'Trong Python `isinstance(True, int)` là `True` — kiểm tra `isinstance(x, bool)` trước.',
      'Mỗi lần thất bại, nối thêm `assistant(reply.content)` và `user("...lỗi...")` vào danh sách messages rồi gọi lại model.',
    ],
    usesLLM: true,
  },
  {
    id: 'lc-agent-loop',
    title: 'Agent loop với 3 tool và xử lý lỗi tool',
    moduleId: 'm1',
    lessonIds: ['lc-tools-messages', 'lc-agents'],
    difficulty: 'medium',
    brief:
      'Tự viết vòng lặp mà `create_agent` chạy bên trong: model quyết định gọi tool → chạy tool → trả kết quả về dưới dạng **tool message** → model trả lời. Agent phải sống sót khi tool lỗi hoặc model gọi tool không tồn tại.',
    requirements: [
      'Hỗ trợ nhiều tool call trong một lượt (parallel tool calls).',
      'Tool raise exception hoặc tool không tồn tại → ghi `Error: ...` vào tool message, không để exception thoát ra ngoài.',
      'Mỗi tool message mang đúng `tool_call_id`.',
      'Dừng sau `max_steps` lần gọi model với câu trả lời `Stopped: max steps reached`.',
    ],
    hints: [
      'Tạo `registry = {t.name: t for t in tools}` để tra tool theo tên.',
      'Sau mỗi `model.invoke(...)`, append chính reply vào messages trước khi append các tool message.',
      'Dùng `for step in range(1, max_steps + 1)` để đếm số lần gọi model.',
    ],
    usesLLM: true,
  },
  {
    id: 'lg-reducers',
    title: 'Reducer và nhánh song song',
    moduleId: 'm2',
    lessonIds: ['lg-state-chatbot', 'lg-advanced'],
    difficulty: 'easy',
    brief:
      'Reducer quyết định **cách cập nhật state**: ghi đè hay gộp. Hãy tự viết reducer gộp message theo `id` (giống `add_messages`) và dùng reducer để hai node chạy song song cùng ghi vào một key mà không mất dữ liệu.',
    requirements: [
      '`merge_messages` thêm id mới, thay thế id cũ tại chỗ, xóa khi có `remove: True`, không sửa list đầu vào.',
      '`build_parallel_search` fan-out từ START tới `flights` và `hotels`, rồi hội tụ ở `summarize`.',
    ],
    hints: [
      'Bắt đầu với `result = list(left or [])` để không mutate input.',
      '`StateGraph(reducers={"options": extend})` đăng ký reducer cho key `options`.',
      'Hai cạnh `add_edge(START, ...)` tạo hai nhánh chạy trong cùng một superstep.',
    ],
  },
  {
    id: 'lg-approval-workflow',
    title: 'Workflow có routing, validate và human approval',
    moduleId: 'm2',
    lessonIds: ['lg-hitl', 'lg-memory-streaming'],
    difficulty: 'hard',
    brief:
      'Xây workflow đặt phòng: phân loại yêu cầu → soạn booking → kiểm tra → nếu số tiền lớn thì **tạm dừng chờ người duyệt** bằng `interrupt()` → hoàn tất. Trạng thái được lưu theo `thread_id` nhờ checkpointer nên có thể resume bằng `Command(resume=...)`.',
    requirements: [
      'Câu hỏi đi nhánh riêng; booking hợp lệ ≤ 500 USD được xác nhận ngay.',
      'Booking lỗi → `status = "invalid"` kèm danh sách lỗi, không hỏi người duyệt.',
      'Booking > 500 USD dừng ở `human_approval`; `get_state(config).next == ("human_approval",)`.',
      'Resume `True` → `confirmed`, `False` → `rejected`.',
    ],
    hints: [
      '`interrupt(payload)` trả về giá trị resume khi node được chạy lại sau `Command(resume=...)`.',
      'Hàm route trả về **tên node** kế tiếp; dùng `add_conditional_edges("validate", route_after_validate)`.',
      'Chỉ graph compile với `checkpointer` mới resume được.',
    ],
  },
  {
    id: 'rag-chunking',
    title: 'Chunking có overlap',
    moduleId: 'm3',
    lessonIds: ['rag-ingestion'],
    difficulty: 'easy',
    brief:
      'Chia tài liệu thành các chunk theo số từ, có phần chồng lấp (overlap) để câu không bị cắt mất ngữ cảnh, rồi gắn metadata nguồn — bước nền của mọi pipeline RAG.',
    requirements: [
      'Mỗi chunk ≤ `max_words` từ; hai chunk liên tiếp chung đúng `overlap` từ.',
      'Không mất từ nào, không sinh chunk đuôi thừa.',
      'Tham số không hợp lệ → `ValueError`.',
      'Document có metadata `{"source", "chunk"}`.',
    ],
    hints: ['Bước nhảy là `max_words - overlap`.', 'Dừng vòng lặp khi `start + max_words >= len(words)`.'],
  },
  {
    id: 'rag-mini',
    title: 'Mini-RAG có trích dẫn và biết từ chối',
    moduleId: 'm3',
    lessonIds: ['rag-embeddings-retrieval', 'rag-generation', 'rag-advanced'],
    difficulty: 'medium',
    brief:
      'Index một bộ tài liệu du lịch, truy xuất theo cosine similarity với metadata filter, trả lời bằng câu trích từ tài liệu kèm nguồn, và **từ chối** khi không đủ bằng chứng. Embedding ở đây là bag-of-words (toy), không phải neural embedding — đủ để học luồng xử lý.',
    requirements: [
      '`retrieve` sắp xếp theo điểm giảm dần, lọc theo `min_score` và `where`.',
      'Câu trả lời là câu trong tài liệu khớp nhiều từ nhất với câu hỏi, kèm `[source]`.',
      'Không có tài liệu vượt ngưỡng → trả `NO_ANSWER`, `grounded: False`.',
    ],
    hints: [
      'Lọc `where` trước khi tính điểm: `all(doc.metadata.get(k) == v for k, v in where.items())`.',
      'Tách câu bằng `split(". ")` rồi chọn câu có `len(set(tokenize(query)) & set(tokenize(s)))` lớn nhất.',
    ],
  },
  {
    id: 'vectorless-tree',
    title: 'Tree index kiểu PageIndex vs flat retrieval',
    moduleId: 'm4',
    lessonIds: ['vl-concept', 'vl-compare'],
    difficulty: 'medium',
    brief:
      'Dựng cây mục lục từ heading Markdown, rồi "suy luận" đi từ gốc xuống lá để tìm mục trả lời câu hỏi — không cần vector. So sánh với flat retrieval trên các chunk đã mất heading để thấy khi nào cấu trúc tài liệu quan trọng.',
    requirements: [
      '`build_tree` tạo cây đúng cấp heading, text gắn vào heading gần nhất.',
      '`navigate` chọn con có điểm cao nhất ở mỗi cấp cho tới lá.',
      '`evaluate` trả accuracy của cả hai phương pháp trên `QUESTIONS`.',
    ],
    hints: [
      'Dùng một stack: pop cho tới khi đỉnh stack có level nhỏ hơn heading mới.',
      'Trong `navigate`, `max(node.children, key=...)` trả phần tử đầu tiên khi hòa điểm.',
    ],
  },
  {
    id: 'deep-agent-todos',
    title: 'Planner + todo list + virtual filesystem',
    moduleId: 'm5',
    lessonIds: ['da-concept', 'da-patterns'],
    difficulty: 'hard',
    brief:
      'Deep agent chia việc lớn thành todo, ghi kết quả trung gian ra filesystem thay vì nhồi vào context, retry khi bước lỗi và không chạy các bước phụ thuộc vào bước đã hỏng.',
    requirements: [
      'Todo chạy theo thứ tự phụ thuộc; `attempts` đếm mọi lần gọi.',
      'Lỗi được retry tới `max_retries`, sau đó `failed` kèm `error`.',
      'Todo không thể chạy vì phụ thuộc hỏng → `blocked`.',
      'Worker không tồn tại được xử lý như lỗi, không crash.',
    ],
    hints: [
      'Vòng ngoài lặp tới khi `todos.ready()` rỗng; vòng trong là retry của từng todo.',
      '`workers[todo.worker]` raise `KeyError` nếu worker không tồn tại — để nó rơi vào nhánh except.',
    ],
  },
  {
    id: 'guardrails',
    title: 'Guardrails: injection, PII, quyền tool',
    moduleId: 'm6',
    lessonIds: ['gr-concept', 'gr-pii', 'gr-injection'],
    difficulty: 'medium',
    brief:
      'Viết lớp phòng thủ nhiều tầng cho agent du lịch: chặn input độc hại, che PII trước khi gửi model/log, phân quyền tool theo vai trò với human approval, và làm sạch nội dung truy xuất (untrusted).',
    requirements: [
      'Mọi case trong `ATTACKS` bị chặn đúng lý do; input bình thường không bị chặn nhầm.',
      'Che email, thẻ 16 số (cách nhau bởi dấu cách/gạch) và số điện thoại VN.',
      '`authorize` trả `deny` / `needs_approval` / `allow` theo least privilege.',
      '`sanitize_retrieved` bỏ dòng chứa chỉ dẫn độc hại và báo `flagged`.',
    ],
    hints: [
      'Dùng `re.search(pattern, text, re.IGNORECASE)`.',
      'Thẻ: `r"\\b(?:\\d[ -]?){15}\\d\\b"`; điện thoại: `r"(?:\\+84|\\b0)\\d{9}\\b"`.',
    ],
  },
  {
    id: 'eval-harness',
    title: 'Bộ evaluation 20 case cho travel agent',
    moduleId: 'm7',
    lessonIds: ['ev-concept', 'ev-agent'],
    difficulty: 'medium',
    brief:
      'Chấm agent trên 20 golden test case: tool selection accuracy, answer pass rate, task success rate, và phát hiện **regression** giữa hai phiên bản. Bạn sẽ thấy v2 có tool accuracy cao hơn nhưng vẫn làm hỏng 4 case từng chạy đúng.',
    requirements: [
      'Tính 3 metric (làm tròn 3 chữ số) và danh sách case thất bại.',
      'So khớp `must_include` không phân biệt hoa thường.',
      '`regressions` trả các id đúng ở baseline nhưng sai ở candidate.',
    ],
    hints: [
      '`round(sum(r.tool_ok for r in results) / n, 3)`.',
      'Tạo dict `{id: success}` cho candidate để tra nhanh.',
    ],
  },
  {
    id: 'llm-gateway',
    title: 'LLM Gateway: retry, fallback, cache, rate limit, usage',
    moduleId: 'm8',
    lessonIds: ['gw-concept', 'gw-litellm'],
    difficulty: 'hard',
    brief:
      'Tự xây phiên bản thu nhỏ của LiteLLM Router: một alias, nhiều provider; retry lỗi tạm thời, fallback khi provider chết, cache, rate limit theo cửa sổ 60 giây và log usage/cost. Provider là mock nên kiểm thử được mọi kịch bản lỗi.',
    requirements: [
      'Retry cùng provider tối đa `max_retries` lần rồi chuyển sang provider kế tiếp.',
      'Cache hit miễn phí và không tính vào rate limit.',
      'Rate limit theo cửa sổ trượt 60 giây dùng `clock`.',
      '`usage_summary` chỉ tính lần gọi thành công, không tính cache.',
    ],
    hints: [
      'Kiểm tra theo thứ tự: alias → cache → rate limit → providers.',
      'Lọc timestamp còn trong cửa sổ: `[t for t in ts if now - t < 60]`.',
    ],
  },
  {
    id: 'tp-structured-plan',
    title: 'Travel Agent 1 — Lịch trình có cấu trúc',
    moduleId: 'm1',
    lessonIds: ['lc-structured'],
    difficulty: 'medium',
    brief:
      'Biến yêu cầu của khách thành `TripPlan` có kiểu, validate số ngày, thứ tự ngày và hoạt động; retry kèm phản hồi lỗi.',
    requirements: ['Validate đầy đủ `TripPlan`.', 'Retry với thông báo lỗi gửi lại model.'],
    hints: ['Duyệt `enumerate(days, start=1)` và so `d.get("day") != i`.'],
    usesLLM: true,
  },
  {
    id: 'tp-graph-workflow',
    title: 'Travel Agent 4 — Workflow LangGraph có vòng review',
    moduleId: 'm2',
    lessonIds: ['lg-overview-components', 'lg-advanced'],
    difficulty: 'medium',
    brief:
      'Nghiên cứu song song (thời tiết + điểm tham quan), soạn lịch trình, review chất lượng và quay lại soạn lại khi chưa đạt — có giới hạn số vòng.',
    requirements: ['Hai nhánh research song song dùng reducer.', 'Vòng review tối đa 3 lần.'],
    hints: ['`route_after_review` trả `END` hoặc `"draft_itinerary"`.'],
  },
  {
    id: 'tp-memory',
    title: 'Travel Agent 5 — Memory theo thread',
    moduleId: 'm2',
    lessonIds: ['lg-memory-streaming'],
    difficulty: 'easy',
    brief:
      'Ghi nhớ sở thích của khách qua nhiều lượt hội thoại bằng checkpointer + reducer gộp dict; mỗi `thread_id` là một phiên độc lập.',
    requirements: [
      'Reducer `merge_prefs` gộp, ghi đè, xóa bằng `None`.',
      'Thread khác nhau không lẫn dữ liệu.',
    ],
    hints: ['`StateGraph(reducers={"messages": add_messages, "preferences": merge_prefs})`.'],
  },
  {
    id: 'tp-tracing',
    title: 'Travel Agent 10 — Tracing và log an toàn',
    moduleId: 'm8',
    lessonIds: ['gw-router-pii'],
    difficulty: 'medium',
    brief:
      'Ghi span lồng nhau cho từng bước của agent (LLM call, tool call), đo thời gian, ghi lỗi, xuất JSONL và **không bao giờ** để lộ secret trong log.',
    requirements: [
      'Span lồng nhau có `parent_id`.',
      'Lỗi được ghi và ném lại.',
      'Secret bị che trước khi lưu.',
    ],
    hints: ['Dùng `@contextmanager` với `try/except/finally`.'],
  },
]

export const exercises: Exercise[] = META.map((m) => {
  const src = sources[m.id]
  if (!src?.starter || !src.solution || !src.tests)
    throw new Error(`Exercise ${m.id} is missing code sections`)
  return { ...m, starter: src.starter, solution: src.solution, tests: src.tests }
})

export const exerciseIdsInSource = Object.keys(sources)
