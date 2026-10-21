import type { LessonMeta } from '../types'

const LG_DOCS = {
  label: 'LangGraph docs (Python)',
  url: 'https://docs.langchain.com/oss/python/langgraph/overview',
}
const REPO = {
  label: 'Repo khóa học: Agentic-LanggraphCrash-course',
  url: 'https://github.com/krishnaik06/Agentic-LanggraphCrash-course',
}

export const m2Lessons: LessonMeta[] = [
  {
    id: 'lg-overview-components',
    title: 'LangGraph là gì: State, Node, Edge',
    summary: 'Vì sao cần graph cho ứng dụng LLM nhiều bước và ba thành phần cốt lõi.',
    source: 'video',
    video: { start: 9312, end: 10770, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Giải thích khi nào workflow cần graph thay vì chain tuyến tính.',
      'Mô tả vai trò của state, node, edge, START, END.',
      'Mô hình hóa một quy trình thực tế thành graph.',
    ],
    tags: ['LangGraph', 'StateGraph', 'node', 'edge', 'START', 'END', 'workflow'],
    checklist: [
      'Vẽ được graph cho quy trình transcript → blog.',
      'Giải thích node nhận gì và trả về gì.',
      'Phân biệt edge thường và conditional edge.',
    ],
    exercises: ['tp-graph-workflow'],
    references: [REPO, LG_DOCS],
  },
  {
    id: 'lg-state-chatbot',
    title: 'State schema, reducer & chatbot đầu tiên',
    summary: '`TypedDict` + `Annotated[list, add_messages]`, xây chatbot một node, invoke và stream.',
    source: 'video',
    video: { start: 10770, end: 12270, precision: 'transcript' },
    studyMinutes: 30,
    objectives: [
      'Định nghĩa state schema với TypedDict.',
      'Hiểu reducer: vì sao messages phải được nối thay vì ghi đè.',
      'Xây, compile và chạy chatbot bằng `invoke` / `stream`.',
    ],
    tags: ['TypedDict', 'Annotated', 'add_messages', 'reducer', 'compile', 'invoke', 'stream'],
    checklist: [
      'Viết state có reducer cho messages.',
      'Giải thích điều gì xảy ra nếu bỏ reducer.',
      'Compile và gọi graph thành công.',
    ],
    exercises: ['lg-reducers'],
    references: [
      REPO,
      { label: 'LangGraph: Graph API', url: 'https://docs.langchain.com/oss/python/langgraph/graph-api' },
    ],
  },
  {
    id: 'lg-tools-react',
    title: 'Tool calling, ToolNode & ReAct agent',
    summary: 'Gắn tool vào LLM trong graph, `ToolNode`, `tools_condition`, và vòng lặp ReAct.',
    source: 'video',
    video: { start: 12270, end: 14445, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Dùng `bind_tools` trong node LLM.',
      'Dùng `ToolNode` và `tools_condition` để route.',
      'Biến graph thành ReAct agent bằng cạnh quay lại từ tools tới LLM.',
    ],
    tags: ['ToolNode', 'tools_condition', 'ReAct', 'bind_tools', 'conditional edge', 'loop'],
    checklist: [
      'Giải thích tools_condition trả về gì.',
      'Vẽ được graph ReAct (llm ⇄ tools).',
      'Biết vì sao graph không có cạnh tools → llm chỉ gọi tool một lần.',
    ],
    exercises: ['lc-agent-loop'],
    references: [
      REPO,
      {
        label: 'LangGraph prebuilt ToolNode',
        url: 'https://langchain-ai.github.io/langgraph/reference/agents/',
      },
    ],
  },
  {
    id: 'lg-memory-streaming',
    title: 'Memory với checkpointer & các chế độ streaming',
    summary: '`MemorySaver` + `thread_id` để nhớ hội thoại; `stream_mode="values"` vs `"updates"`.',
    source: 'video',
    video: { start: 14445, end: 15570, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Thêm checkpointer để graph nhớ trạng thái theo thread.',
      'Phân biệt stream `values` và `updates`.',
      'Chọn checkpointer phù hợp cho production.',
    ],
    tags: [
      'checkpointer',
      'MemorySaver',
      'InMemorySaver',
      'thread_id',
      'stream_mode',
      'values',
      'updates',
      'persistence',
    ],
    checklist: [
      'Giải thích thread_id.',
      'Biết InMemorySaver mất dữ liệu khi restart.',
      'Chọn được stream mode cho UI chat.',
    ],
    exercises: ['tp-memory', 'lg-approval-workflow'],
    references: [
      REPO,
      { label: 'LangGraph: Persistence', url: 'https://docs.langchain.com/oss/python/langgraph/persistence' },
    ],
  },
  {
    id: 'lg-hitl',
    title: 'Human-in-the-loop với `interrupt`',
    summary: 'Tạm dừng graph để hỏi người, lưu trạng thái, resume bằng `Command(resume=...)`.',
    source: 'video',
    video: { start: 15570, end: 16050, precision: 'transcript' },
    studyMinutes: 25,
    objectives: [
      'Dùng `interrupt()` trong node hoặc tool.',
      'Resume graph bằng `Command`.',
      'Thiết kế điểm dừng hợp lý.',
    ],
    tags: ['interrupt', 'Command', 'resume', 'human-in-the-loop', 'approval'],
    checklist: [
      'Giải thích vì sao interrupt cần checkpointer.',
      'Biết node bị chạy lại từ đầu khi resume.',
      'Đặt interrupt trước hành động không thể hoàn tác.',
    ],
    exercises: ['lg-approval-workflow'],
    references: [
      REPO,
      { label: 'LangGraph: Interrupts', url: 'https://docs.langchain.com/oss/python/langgraph/interrupts' },
    ],
  },
  {
    id: 'lg-mcp',
    title: 'MCP: tự viết MCP server và nối vào agent',
    summary: 'Model Context Protocol, transport stdio và streamable HTTP, `MultiServerMCPClient`.',
    source: 'video',
    video: { start: 16050, end: 18149, precision: 'transcript' },
    studyMinutes: 35,
    objectives: [
      'Giải thích MCP giải quyết vấn đề gì.',
      'Viết MCP server bằng FastMCP với transport stdio và streamable HTTP.',
      'Lấy tool từ nhiều server bằng `MultiServerMCPClient` và đưa vào agent.',
    ],
    tags: [
      'MCP',
      'Model Context Protocol',
      'FastMCP',
      'stdio',
      'streamable-http',
      'MultiServerMCPClient',
      'langchain-mcp-adapters',
    ],
    checklist: [
      'Phân biệt stdio và HTTP transport.',
      'Biết tool MCP được lấy bất đồng bộ.',
      'Nêu rủi ro bảo mật khi dùng MCP server bên thứ ba.',
    ],
    references: [
      REPO,
      { label: 'Model Context Protocol', url: 'https://modelcontextprotocol.io/' },
      { label: 'langchain-mcp-adapters', url: 'https://github.com/langchain-ai/langchain-mcp-adapters' },
    ],
  },
  {
    id: 'lg-advanced',
    title: 'Nâng cao: song song, subgraph, retry & recovery',
    summary: 'Fan-out/fan-in, `Send`, subgraph, retry policy, recursion limit, time travel.',
    source: 'supplement',
    studyMinutes: 35,
    objectives: [
      'Chạy node song song và gộp kết quả bằng reducer.',
      'Tách graph lớn thành subgraph.',
      'Thiết kế retry, giới hạn vòng lặp và khôi phục từ checkpoint.',
    ],
    tags: [
      'parallel',
      'fan-out',
      'Send',
      'map-reduce',
      'subgraph',
      'RetryPolicy',
      'recursion_limit',
      'time travel',
    ],
    checklist: [
      'Giải thích InvalidUpdateError khi ghi song song.',
      'Biết khi nào dùng Send.',
      'Mọi vòng lặp đều có điều kiện dừng.',
    ],
    exercises: ['lg-reducers', 'tp-graph-workflow'],
    references: [
      LG_DOCS,
      {
        label: 'LangGraph: Graph API (Send, Command)',
        url: 'https://docs.langchain.com/oss/python/langgraph/graph-api',
      },
    ],
  },
]
