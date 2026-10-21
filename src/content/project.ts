import { exercises } from './exercises'
import type { Exercise, ProjectStage } from './types'

const ex = (id: string): Exercise => {
  const found = exercises.find((e) => e.id === id)
  if (!found) throw new Error(`Unknown exercise ${id}`)
  return found
}

const INSTALL = 'uv add langchain langchain-openai langgraph python-dotenv'

export const PROJECT = {
  id: 'travel-agent',
  title: 'Travel Planning Agent',
  pitch:
    'Một agent lập kế hoạch du lịch được xây dần qua 10 giai đoạn, mỗi giai đoạn áp dụng kiến thức của một module. Phần chạy trong trình duyệt dùng labkit (mock, không tốn phí); mỗi giai đoạn kèm code tham khảo cho stack thật để chạy trên máy bạn.',
}

export const projectStages: ProjectStage[] = [
  {
    id: 'stage-1',
    index: 1,
    title: 'Gọi LLM & structured output',
    moduleIds: ['m1'],
    goal: 'Biến yêu cầu tự do của khách ("3 ngày Huế, 250 USD") thành `TripPlan` có kiểu, đã validate.',
    concepts: ['Chat model', 'System prompt', 'Structured output', 'Validation + retry'],
    deliverable: [
      '`parse_plan()` validate đầy đủ',
      '`plan_trip()` retry kèm phản hồi lỗi',
      'Tất cả test xanh',
    ],
    checklist: [
      'Schema có mô tả cho mọi trường',
      'Lỗi validate nêu rõ trường sai',
      'Có giới hạn số lần retry',
    ],
    criteria: ['Không bao giờ trả về plan sai số ngày', 'Không vòng lặp vô hạn khi model trả sai liên tục'],
    pitfalls: [
      'Tin rằng JSON hợp lệ là dữ liệu đúng',
      'Quên kiểm tra thứ tự ngày',
      'Để `bool` lọt qua kiểm tra số',
    ],
    improvements: [
      'Dùng Pydantic + `with_structured_output` khi chạy thật',
      'Ghi log các lần retry để phát hiện prompt kém',
    ],
    exercise: ex('tp-structured-plan'),
    localCode: {
      title: 'LangChain thật: with_structured_output',
      install: `${INSTALL} pydantic`,
      code: `from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model

load_dotenv()

class DayPlan(BaseModel):
    day: int = Field(ge=1)
    city: str
    activities: list[str] = Field(min_length=1, max_length=5)

class TripPlan(BaseModel):
    destination: str
    total_budget_usd: float = Field(gt=0)
    days: list[DayPlan]

model = init_chat_model("openai:gpt-4o-mini").with_structured_output(TripPlan)
plan = model.invoke("Lập lịch trình 2 ngày ở Huế, ngân sách 250 USD")
assert len(plan.days) == 2, "Kiểm tra nghiệp vụ vẫn là việc của bạn"
print(plan.model_dump_json(indent=2))`,
    },
  },
  {
    id: 'stage-2',
    index: 2,
    title: 'Tool calling',
    moduleIds: ['m1'],
    goal: 'Cho agent dùng 3 tool (thời tiết, đổi tiền, điểm tham quan) và sống sót khi tool lỗi.',
    concepts: ['@tool', 'tool_calls', 'ToolMessage', 'Agent loop', 'Error handling'],
    deliverable: [
      'Vòng lặp agent hỗ trợ nhiều tool call/lượt',
      'Lỗi tool trả về model, không crash',
      'Giới hạn số bước',
    ],
    checklist: [
      'Docstring tool nói rõ khi nào dùng',
      'Mỗi ToolMessage có tool_call_id',
      'Có test cho tool không tồn tại',
    ],
    criteria: [
      'Agent không bao giờ raise ra ngoài vì lỗi tool',
      'Log đủ để biết tool nào được gọi với tham số gì',
    ],
    pitfalls: ['Append ToolMessage trước AIMessage', 'Nuốt lỗi và bịa kết quả', 'Quên giới hạn bước'],
    improvements: ['Validate tham số tool theo schema trước khi chạy', 'Timeout cho tool gọi mạng'],
    exercise: ex('lc-agent-loop'),
    localCode: {
      title: 'LangChain thật: create_agent',
      install: INSTALL,
      code: `from langchain.agents import create_agent
from langchain.tools import tool

@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city. Use for any weather question."""
    ...  # gọi API thời tiết thật ở đây

@tool
def search_attractions(city: str) -> str:
    """List top attractions in a city."""
    ...

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather, search_attractions],
    system_prompt="You are a travel assistant. Answer in Vietnamese.",
)
out = agent.invoke({"messages": [{"role": "user", "content": "Đà Nẵng tuần này thời tiết thế nào, nên đi đâu?"}]},
                   {"recursion_limit": 10})
print(out["messages"][-1].content)`,
    },
  },
  {
    id: 'stage-3',
    index: 3,
    title: 'Retrieval & RAG',
    moduleIds: ['m3'],
    goal: 'Trả lời câu hỏi về điểm đến và chính sách (visa, hoàn tiền) từ tài liệu riêng, có trích nguồn, biết từ chối.',
    concepts: ['Chunking', 'Embedding', 'Vector search', 'Metadata filter', 'Grounding', 'Citation'],
    deliverable: [
      'Index tài liệu du lịch',
      'Retrieve có ngưỡng và filter',
      'Câu trả lời kèm nguồn hoặc từ chối',
    ],
    checklist: [
      'Mỗi chunk có metadata source',
      'Có ngưỡng điểm tối thiểu',
      'Có test cho câu hỏi ngoài phạm vi',
    ],
    criteria: ['Không trả lời khi không có bằng chứng', 'Trích dẫn đúng tài liệu được dùng'],
    pitfalls: [
      'Luôn trả top-k dù điểm rất thấp',
      'Chunk quá lớn làm loãng tín hiệu',
      'Mất metadata khi chunk',
    ],
    improvements: ['Hybrid BM25 + vector', 'Reranker', 'Đo recall@k trên bộ câu hỏi (Module 7)'],
    exercise: ex('rag-mini'),
    localCode: {
      title: 'Stack thật: sentence-transformers + Chroma (như trong video)',
      install: 'uv add langchain-community langchain-text-splitters sentence-transformers chromadb pypdf',
      code: `from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb

docs = DirectoryLoader("data/pdf", glob="**/*.pdf", loader_cls=PyPDFLoader).load()
chunks = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200).split_documents(docs)

embedder = SentenceTransformer("all-MiniLM-L6-v2")          # 384 chiều
col = chromadb.PersistentClient(path="data/vector_store").get_or_create_collection("travel")
col.add(
    ids=[f"c{i}" for i in range(len(chunks))],
    documents=[c.page_content for c in chunks],
    metadatas=[c.metadata for c in chunks],
    embeddings=embedder.encode([c.page_content for c in chunks]).tolist(),
)
hits = col.query(query_embeddings=embedder.encode(["Hủy phòng có được hoàn tiền?"]).tolist(), n_results=3)
print(hits["documents"][0], hits["distances"][0])`,
    },
  },
  {
    id: 'stage-4',
    index: 4,
    title: 'Workflow với LangGraph',
    moduleIds: ['m2'],
    goal: 'Tách agent thành graph: phân tích yêu cầu → nghiên cứu song song → soạn lịch trình → review, lặp có giới hạn.',
    concepts: ['StateGraph', 'Reducer', 'Parallel fan-out', 'Conditional edge', 'Loop'],
    deliverable: ['Graph chạy đúng trên 3 kịch bản test', 'Vòng review tối đa 3 lần'],
    checklist: [
      'Key được ghi song song có reducer',
      'Mọi vòng lặp có điều kiện dừng',
      'Có thể stream từng bước',
    ],
    criteria: ['Không có InvalidUpdateError', 'Graph luôn kết thúc'],
    pitfalls: ['Vòng lặp review không giới hạn', 'Hai node ghi cùng key không có reducer'],
    improvements: ['Thay `draft_itinerary` bằng LLM thật', 'Dùng subgraph cho phần research'],
    exercise: ex('tp-graph-workflow'),
    localCode: {
      title: 'LangGraph thật',
      install: INSTALL,
      code: `import operator
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    request: dict
    research: Annotated[list[str], operator.add]   # reducer cho nhánh song song
    itinerary: list
    attempt: int
    approved: bool

g = StateGraph(State)
g.add_node("parse_request", parse_request)
g.add_node("research_weather", research_weather)
g.add_node("research_sights", research_sights)
g.add_node("draft_itinerary", draft_itinerary)
g.add_node("review", review)
g.add_edge(START, "parse_request")
g.add_edge("parse_request", "research_weather")
g.add_edge("parse_request", "research_sights")
g.add_edge(["research_weather", "research_sights"], "draft_itinerary")  # chờ cả hai nhánh
g.add_edge("draft_itinerary", "review")
g.add_conditional_edges("review", lambda s: END if s["approved"] or s["attempt"] >= 3 else "draft_itinerary")
app = g.compile()`,
    },
  },
  {
    id: 'stage-5',
    index: 5,
    title: 'State, memory & checkpoint',
    moduleIds: ['m2'],
    goal: 'Ghi nhớ sở thích của từng khách qua nhiều lượt chat, tách biệt giữa các phiên.',
    concepts: ['Checkpointer', 'thread_id', 'Reducer cho dict', 'get_state / history'],
    deliverable: ['Reducer `merge_prefs`', 'Graph có checkpointer', 'Test cách ly giữa thread'],
    checklist: [
      'Mỗi người dùng một thread_id',
      'Có cách xóa sở thích (None)',
      'Biết checkpointer nào dùng cho production',
    ],
    criteria: ['Lượt sau nhớ dữ liệu lượt trước', 'Không rò rỉ dữ liệu giữa người dùng'],
    pitfalls: ['Dùng InMemorySaver cho production (mất khi restart)', 'thread_id dùng chung'],
    improvements: ['SqliteSaver/PostgresSaver', 'Long-term memory store tách khỏi lịch sử hội thoại'],
    exercise: ex('tp-memory'),
    localCode: {
      title: 'LangGraph thật: checkpointer',
      install: INSTALL,
      code: `from langgraph.checkpoint.memory import InMemorySaver

app = graph.compile(checkpointer=InMemorySaver())   # production: SqliteSaver / PostgresSaver
cfg = {"configurable": {"thread_id": "user-42"}}
app.invoke({"messages": [{"role": "user", "content": "Ngân sách 600 USD"}]}, cfg)
app.invoke({"messages": [{"role": "user", "content": "Mình thích biển"}]}, cfg)
print(app.get_state(cfg).values["preferences"])`,
    },
  },
  {
    id: 'stage-6',
    index: 6,
    title: 'Agent lập kế hoạch',
    moduleIds: ['m5'],
    goal: 'Chia "lên kế hoạch chuyến đi" thành todo có phụ thuộc, lưu artifact vào filesystem, retry và chặn bước phụ thuộc khi lỗi.',
    concepts: ['Task decomposition', 'Todo management', 'Virtual filesystem', 'Recovery'],
    deliverable: ['TodoList + VirtualFS', '`run_plan` có retry và blocked'],
    checklist: [
      'Trạng thái todo rõ ràng',
      'Artifact ghi ra FS thay vì nhồi vào context',
      'Lỗi có thông tin để debug',
    ],
    criteria: ['Bước lỗi không kéo sập toàn bộ kế hoạch', 'Kết quả kiểm tra lại được từ FS'],
    pitfalls: ['Retry vô hạn', 'Chạy bước phụ thuộc khi bước trước hỏng'],
    improvements: ['Dùng `deepagents` với subagent research', 'Cho người dùng duyệt plan trước khi chạy'],
    exercise: ex('deep-agent-todos'),
    localCode: {
      title: 'deepagents thật',
      install: 'uv add deepagents tavily-python',
      code: `from deepagents import create_deep_agent

research_subagent = {
    "name": "researcher",
    "description": "Research weather, attractions and prices for a destination.",
    "system_prompt": "You are a meticulous travel researcher. Cite sources.",
    "tools": [internet_search],
}

agent = create_deep_agent(
    model="openai:gpt-4o-mini",
    tools=[internet_search],
    system_prompt="Plan trips. Write a todo list first, save notes to files, then write the final itinerary.",
    subagents=[research_subagent],
)
result = agent.invoke({"messages": [{"role": "user", "content": "Lên kế hoạch 3 ngày ở Đà Lạt, 700 USD"}]})
print(result["files"].keys())   # các file agent đã ghi`,
    },
  },
  {
    id: 'stage-7',
    index: 7,
    title: 'Guardrails & phân quyền',
    moduleIds: ['m6'],
    goal: 'Chặn prompt injection, che PII, phân quyền tool theo vai trò và yêu cầu duyệt trước khi đặt phòng/gửi email.',
    concepts: [
      'Input/output validation',
      'PII redaction',
      'Least privilege',
      'Human approval',
      'Untrusted content',
    ],
    deliverable: ['check_input, redact_pii, authorize, sanitize_retrieved', 'Test với 7 kịch bản tấn công'],
    checklist: [
      'Có test false positive',
      'Tool nhạy cảm luôn cần duyệt',
      'Nội dung truy xuất không được coi là chỉ dẫn',
    ],
    criteria: ['Mọi tấn công trong bộ test bị chặn', 'Input hợp lệ không bị chặn nhầm'],
    pitfalls: ['Chỉ dựa vào system prompt để chống injection', 'Log chứa PII', 'Cho guest dùng tool ghi'],
    improvements: ['Thêm guardrail model-based cho output', 'Audit log mọi lần duyệt'],
    exercise: ex('guardrails'),
    localCode: {
      title: 'LangChain thật: PII + HITL middleware',
      install: INSTALL,
      code: `from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware, HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[search_hotels, book_hotel, send_email],
    middleware=[
        PIIMiddleware("email", strategy="redact", apply_to_input=True),
        PIIMiddleware("credit_card", strategy="mask", apply_to_input=True),
        HumanInTheLoopMiddleware(interrupt_on={"book_hotel": True, "send_email": True}),
    ],
    checkpointer=InMemorySaver(),
)`,
    },
  },
  {
    id: 'stage-8',
    index: 8,
    title: 'Evaluation',
    moduleIds: ['m7'],
    goal: 'Đo agent trên 20 golden test case và chặn regression trước khi phát hành phiên bản mới.',
    concepts: ['Golden dataset', 'Tool selection accuracy', 'Task success', 'Regression testing'],
    deliverable: ['evaluate() với 3 metric', 'regressions() giữa 2 phiên bản'],
    checklist: [
      'Dataset có case khó và case không cần tool',
      'Metric tách theo khía cạnh',
      'So sánh theo từng case, không chỉ số tổng',
    ],
    criteria: ['Phát hiện đúng 4 regression của v2', 'Kết quả tái lập được'],
    pitfalls: ['Chỉ nhìn metric tổng', 'Dataset toàn case dễ'],
    improvements: ['LangSmith experiment', 'LLM-as-a-judge cho câu trả lời tự do', 'Đo latency và cost'],
    exercise: ex('eval-harness'),
    localCode: {
      title: 'LangSmith thật',
      install: 'uv add langsmith',
      code: `from langsmith import Client

client = Client()   # cần LANGSMITH_API_KEY
ds = client.create_dataset(dataset_name="travel-agent-golden")
client.create_examples(dataset_id=ds.id, examples=[
    {"inputs": {"question": c["question"]}, "outputs": {"tool": c["expected_tool"]}} for c in DATASET
])

def tool_selection(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["tool"] == reference_outputs["tool"]

client.evaluate(lambda inputs: agent_v2(inputs["question"]), data="travel-agent-golden",
                evaluators=[tool_selection], experiment_prefix="agent-v2")`,
    },
  },
  {
    id: 'stage-9',
    index: 9,
    title: 'LLM Gateway',
    moduleIds: ['m8'],
    goal: 'Đặt agent sau một gateway có retry, fallback, cache, rate limit và theo dõi chi phí.',
    concepts: ['Unified API', 'Fallback', 'Retry', 'Rate limiting', 'Caching', 'Usage tracking'],
    deliverable: ['Gateway với mock provider', 'Báo cáo usage theo provider'],
    checklist: ['Phân biệt lỗi tạm thời và lỗi vĩnh viễn', 'Cache không tính phí', 'Log mọi lần thử'],
    criteria: ['Mọi test kịch bản lỗi đều xanh', 'Chi phí tính đúng'],
    pitfalls: ['Retry cả lỗi 4xx do request sai', 'Cache câu trả lời có dữ liệu cá nhân'],
    improvements: ['LiteLLM Router thật', 'Budget theo người dùng', 'Semantic cache'],
    exercise: ex('llm-gateway'),
    localCode: {
      title: 'LiteLLM Router thật',
      install: 'uv add litellm',
      code: `import os
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "chat", "litellm_params": {"model": "openai/gpt-4o-mini", "api_key": os.environ["OPENAI_API_KEY"]}},
        {"model_name": "chat-backup", "litellm_params": {"model": "groq/llama-3.3-70b-versatile", "api_key": os.environ["GROQ_API_KEY"]}},
    ],
    fallbacks=[{"chat": ["chat-backup"]}],
    num_retries=2,
)
resp = router.completion(model="chat", messages=[{"role": "user", "content": "Gợi ý 2 ngày ở Huế"}])
print(resp.model, resp.usage)`,
    },
  },
  {
    id: 'stage-10',
    index: 10,
    title: 'Tracing, logging & triển khai',
    moduleIds: ['m7', 'm8'],
    goal: 'Ghi trace có cấu trúc cho mọi bước của agent, không lộ secret, sẵn sàng đưa lên server.',
    concepts: ['Span', 'Trace', 'Structured logging', 'Secret redaction', 'Deployment'],
    deliverable: ['Tracer với span lồng nhau', 'Export JSONL', 'Checklist triển khai'],
    checklist: [
      'Mỗi LLM/tool call là một span',
      'Secret không bao giờ vào log',
      'Có trace_id để tra cứu lỗi của người dùng',
    ],
    criteria: ['Tái hiện được một lượt chạy từ log', 'Không có secret trong file log'],
    pitfalls: ['Log toàn bộ prompt có PII', 'Không ghi lỗi của tool'],
    improvements: [
      'Bật LangSmith tracing (`LANGSMITH_TRACING=true`)',
      'OpenTelemetry',
      'Đóng gói FastAPI + Docker',
    ],
    exercise: ex('tp-tracing'),
    localCode: {
      title: 'Triển khai tối thiểu với FastAPI + LangSmith tracing',
      install: 'uv add fastapi uvicorn langsmith',
      code: `# .env: LANGSMITH_TRACING=true, LANGSMITH_API_KEY=..., OPENAI_API_KEY=...
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatIn(BaseModel):
    thread_id: str
    message: str

@app.post("/chat")
def chat(body: ChatIn):
    cfg = {"configurable": {"thread_id": body.thread_id}}
    out = agent.invoke({"messages": [{"role": "user", "content": body.message}]}, cfg)
    return {"reply": out["messages"][-1].content}

# uv run uvicorn main:app --port 8000`,
    },
  },
]
