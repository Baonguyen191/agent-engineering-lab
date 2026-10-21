<!-- lesson: lc-intro -->
## Bức tranh tổng thể

Khóa học đi theo đúng thứ tự một kỹ sư xây hệ thống agent thực tế: trước hết học cách **gọi model và dùng tool** (LangChain), sau đó **điều phối nhiều bước có trạng thái** (LangGraph), cho model **truy cập tri thức riêng** (RAG, Vectorless RAG), xử lý **tác vụ dài** (Deep Agents), rồi làm cho hệ thống **an toàn, đo được và vận hành được** (Guardrails, Evaluation, Gateways).

```flow
LangChain: model + tools -> LangGraph: workflow có state
LangGraph: workflow có state -> RAG / Vectorless RAG: tri thức
RAG / Vectorless RAG: tri thức -> Deep Agents: tác vụ dài
Deep Agents: tác vụ dài -> Guardrails + Evals + Gateway: production
```

> Ứng dụng này biến từng phần của video thành bài học nhỏ. Mỗi bài có nút mở video đúng đoạn, phần giải thích, quiz, flashcard và bài lab chạy được ngay trong trình duyệt.

## Môi trường: vì sao dùng `uv`

Trong video, dự án được tạo bằng **uv** — trình quản lý package/virtualenv viết bằng Rust, nhanh hơn `pip` nhiều lần và gom các bước `venv` + `pip install` + lock file vào một công cụ.

```bash
uv init agentic-course        # tạo project + pyproject.toml
cd agentic-course
uv venv                       # tạo .venv
# Windows: .venv\Scripts\activate   |  macOS/Linux: source .venv/bin/activate
uv add -r requirements.txt    # cài và ghi dependency vào pyproject.toml
uv add ipykernel              # để chọn .venv làm kernel cho Jupyter
```

| Việc cần làm | pip truyền thống | uv |
|---|---|---|
| Tạo môi trường | `python -m venv .venv` | `uv venv` |
| Cài từ requirements | `pip install -r requirements.txt` | `uv add -r requirements.txt` |
| Khóa phiên bản | cần thêm pip-tools/poetry | `uv.lock` tự sinh |

## API key và file `.env`

```python
from dotenv import load_dotenv
import os

load_dotenv()  # đọc .env vào biến môi trường
assert os.getenv("OPENAI_API_KEY"), "Thiếu OPENAI_API_KEY trong .env"
```

```text
# .env  (KHÔNG commit file này)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=...
```

**Lỗi thường gặp**

- Quên thêm `.env` vào `.gitignore` → lộ key trên GitHub. Hãy xoay (rotate) key ngay nếu lỡ commit.
- Chạy notebook bằng kernel hệ thống thay vì `.venv` → `ModuleNotFoundError` dù đã cài package.
- Gọi `load_dotenv()` sau khi khởi tạo client → client không thấy key.

```selfcheck
Q: Vì sao cần chọn kernel `.venv` khi mở notebook trong VS Code?
A: Vì package được cài vào môi trường `.venv`; kernel khác (Python hệ thống) không nhìn thấy các package đó nên import sẽ lỗi.
Q: Bạn lỡ push file `.env` có API key lên GitHub public. Việc đầu tiên cần làm là gì?
A: Thu hồi/xoay key trên trang của provider. Xóa file khỏi lịch sử git là cần nhưng không đủ, vì key có thể đã bị bot thu thập.
```

<!-- lesson: lc-agents -->
## LLM thuần vs Agent

Một LLM đơn lẻ chỉ nhận text và sinh text. Nó **không biết** thông tin thời gian thực (thời tiết hôm nay, tin AI mới nhất) và **không thể hành động** (gửi email, đặt phòng). Video minh họa bằng câu hỏi "tin AI hôm nay là gì?" — model chỉ có thể đoán dựa trên dữ liệu huấn luyện.

**Agent** = model + tools + vòng lặp ra quyết định. Model đọc câu hỏi, *quyết định* có cần gọi tool không, đọc kết quả tool, rồi quyết định bước tiếp theo cho tới khi trả lời được.

```flow
User question -> Model quyết định
Model quyết định -> Gọi tool (get_weather)
Gọi tool (get_weather) -> Model đọc kết quả
Model đọc kết quả -> Trả lời cuối
```

## `create_agent` trong LangChain v1

Ví dụ trong video dùng một hàm `get_weather(city)` giả lập làm tool ([xem đoạn này](#t=1800)). Phiên bản tối thiểu:

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get the current weather for a given city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="openai:gpt-4o-mini",          # hoặc "groq:qwen/qwen3-32b", "google_genai:gemini-2.5-flash"
    tools=[get_weather],
    system_prompt="You are a helpful assistant.",
)

result = agent.invoke({"messages": [{"role": "user", "content": "What is the weather in New York?"}]})
print(result["messages"][-1].content)
```

**Đầu vào → đầu ra (rút gọn)**

```text
messages:
  HumanMessage   "What is the weather in New York?"
  AIMessage      tool_calls=[get_weather(city="New York")]
  ToolMessage    "It's always sunny in New York!"
  AIMessage      "The weather in New York is sunny."
```

`result["messages"]` chứa **toàn bộ** lịch sử — đây là thứ bạn debug khi agent hành xử lạ.

## Agent dừng khi nào?

Khi model trả về `AIMessage` **không có** `tool_calls`. Vì vậy cần giới hạn số bước (recursion limit) để tránh agent gọi tool vô hạn khi model "bối rối".

| | Chain cố định | Agent |
|---|---|---|
| Ai quyết định bước tiếp theo | Lập trình viên | Model |
| Dự đoán được | Cao | Thấp hơn |
| Phù hợp | Quy trình biết trước | Câu hỏi mở, cần chọn tool |
| Rủi ro | Thấp | Gọi sai tool, lặp vô hạn, tốn chi phí |

**Lỗi thường gặp**

- Docstring tool mơ hồ → model không biết khi nào dùng. Docstring *là* mô tả tool gửi cho model.
- Cho agent quá nhiều tool gần giống nhau → chọn nhầm.
- Không đặt giới hạn bước → hóa đơn API bất ngờ.

> Bài lab **Agent loop** cho bạn tự viết vòng lặp này — cách tốt nhất để hiểu `create_agent` làm gì bên trong.

```selfcheck
Q: Trong vòng lặp agent, tín hiệu nào cho biết model đã sẵn sàng trả lời?
A: AIMessage không còn `tool_calls`.
Q: Câu hỏi "Thủ đô của Pháp là gì?" có cần agent không?
A: Thường là không — một LLM call đơn đủ trả lời; agent chỉ thêm độ trễ và chi phí.
```

<!-- lesson: lc-models -->
## Một interface cho mọi provider

Video trình bày nhiều cách khởi tạo model: dùng class riêng của từng provider (`ChatOpenAI`, `ChatGoogleGenerativeAI`, `ChatGroq`) hoặc dùng **`init_chat_model`** với chuỗi `"provider:model"`.

```python
from langchain.chat_models import init_chat_model

gpt = init_chat_model("openai:gpt-4.1")
gemini = init_chat_model("google_genai:gemini-2.5-flash")
qwen = init_chat_model("groq:qwen/qwen3-32b")

for m in (gpt, gemini, qwen):
    print(m.invoke("Why do parrots have colorful feathers?").content[:80])
```

Lợi ích: đổi model chỉ bằng cấu hình, logic agent giữ nguyên — nền tảng cho **model selection** và **LLM gateway** ở Module 8.

> Tên model thay đổi rất nhanh. Luôn kiểm tra tên model còn được provider hỗ trợ trước khi chạy code cũ.

## invoke, stream, batch

```flow
invoke: 1 request -> chờ trọn câu trả lời
stream: 1 request -> nhận từng chunk ngay khi sinh
batch: N request -> chạy song song, trả list kết quả
```

```python
# Streaming: in từng phần ngay khi model sinh ra
for chunk in gpt.stream("Why do parrots have colorful feathers?"):
    print(chunk.text, end="", flush=True)

# Batch: nhiều câu hỏi, giới hạn số request đồng thời
answers = gpt.batch(
    ["What is RAG?", "What is LangGraph?", "What is MCP?"],
    config={"max_concurrency": 2},
)
```

| Phương thức | Dùng khi | Lưu ý |
|---|---|---|
| `invoke` | Script, xử lý nền | Người dùng phải chờ toàn bộ |
| `stream` | Chatbot, UI | Time-to-first-token thấp; cần xử lý chunk |
| `batch` | Đánh giá, xử lý hàng loạt | Đặt `max_concurrency` để không bị rate limit |
| `ainvoke` / `astream` | Server async (FastAPI) | Không chặn event loop |

## Chọn model thế nào?

Cân nhắc 4 trục: **chất lượng** cho tác vụ cụ thể, **độ trễ**, **chi phí/token**, **khả năng** (tool calling, structured output, multimodal, context length). Một hệ thống thực thường dùng nhiều model: model nhỏ, rẻ cho phân loại/routing; model mạnh cho suy luận khó.

**Lỗi thường gặp**

- Dùng `batch` không giới hạn concurrency → lỗi 429 (rate limit).
- So sánh model bằng "cảm giác" thay vì một bộ test cố định (xem Module 7).

```selfcheck
Q: Chatbot của bạn mất 8 giây mới hiện câu trả lời. Thay đổi nào cải thiện trải nghiệm mà không cần đổi model?
A: Dùng `stream` để hiển thị token ngay khi được sinh; tổng thời gian không đổi nhưng thời gian tới token đầu tiên giảm mạnh.
Q: Lợi ích chính của `init_chat_model` so với import từng class provider?
A: Đổi provider/model bằng một chuỗi cấu hình, không phải sửa import và code khởi tạo.
```

<!-- lesson: lc-tools-messages -->
## Tool: hợp đồng giữa code và model

Tool là một hàm Python kèm **tên, mô tả và schema tham số**. Model không chạy code — nó chỉ *đề xuất* lời gọi (`tool_calls`); ứng dụng của bạn mới thực thi.

```python
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get the current weather for a location. Use for any weather question."""
    return f"It's sunny in {location}."

model_with_tools = gpt.bind_tools([get_weather])
response = model_with_tools.invoke("What's the weather like in Boston?")
for call in response.tool_calls:
    print(call["name"], call["args"])   # get_weather {'location': 'Boston'}
```

Sau đó bạn chạy tool và gửi kết quả lại bằng `ToolMessage` để model viết câu trả lời cuối — đúng luồng video trình bày.

```flow
HumanMessage -> AIMessage (tool_calls)
AIMessage (tool_calls) -> Code chạy tool
Code chạy tool -> ToolMessage (tool_call_id)
ToolMessage (tool_call_id) -> AIMessage (câu trả lời)
```

## Bốn loại message

| Message | Ai tạo | Vai trò |
|---|---|---|
| `SystemMessage` | Lập trình viên | Vai trò, quy tắc, giọng điệu, ràng buộc |
| `HumanMessage` | Người dùng | Câu hỏi / yêu cầu |
| `AIMessage` | Model | Câu trả lời hoặc `tool_calls`; kèm `usage_metadata` |
| `ToolMessage` | Ứng dụng | Kết quả tool, liên kết bằng `tool_call_id` |

```python
from langchain.messages import SystemMessage, HumanMessage

messages = [
    SystemMessage("You are a concise travel assistant. Answer in Vietnamese."),
    HumanMessage("Gợi ý 3 món ăn ở Huế"),
]
print(gpt.invoke(messages).content)
```

Bạn cũng có thể truyền dict `{"role": "user", "content": "..."}` — LangChain tự chuyển đổi.

## Tool lỗi thì sao?

API thời tiết có thể timeout, thành phố có thể không tồn tại. Nguyên tắc: **bắt lỗi và trả lỗi về cho model dưới dạng ToolMessage**, để model xin lỗi, thử tham số khác hoặc hỏi lại người dùng — thay vì làm sập cả agent.

```python
try:
    output = tool_fn.invoke(call["args"])
except Exception as e:
    output = f"Error: {e}"
messages.append(ToolMessage(content=str(output), tool_call_id=call["id"]))
```

**Lỗi thường gặp**

- Thiếu `tool_call_id` → provider từ chối request vì tool call không có kết quả tương ứng.
- Tool trả về object phức tạp không serialize được → chuyển sang string/JSON.
- Docstring không nói *khi nào* dùng tool → model gọi sai.

```selfcheck
Q: Model có tự thực thi hàm Python của tool không?
A: Không. Model chỉ sinh `tool_calls` (tên + tham số); ứng dụng thực thi và gửi kết quả bằng ToolMessage.
Q: Vì sao nên trả lỗi tool cho model thay vì raise exception ra ngoài?
A: Để model có cơ hội tự phục hồi (thử lại, hỏi lại, giải thích cho người dùng) và agent không bị dừng đột ngột.
```

<!-- lesson: lc-structured -->
## Vì sao cần structured output

Ứng dụng cần **dữ liệu**, không phải đoạn văn: lưu DB, gọi API, hiển thị form. Video dùng ví dụ trích thông tin phim (tên, năm, đạo diễn, rating dạng float) và trích thông tin liên hệ từ văn bản ([đoạn Pydantic](#t=5220)).

```python
from pydantic import BaseModel, Field

class Movie(BaseModel):
    title: str = Field(description="Movie title")
    year: int = Field(description="Release year")
    director: str
    rating: float = Field(ge=0, le=10, description="Rating out of 10")

structured = gpt.with_structured_output(Movie)
movie = structured.invoke("Provide details about the movie Inception")
print(movie.title, movie.rating)   # đối tượng Movie đã được validate
```

## Pydantic, TypedDict hay dataclass?

Video lần lượt trình bày cả ba ([TypedDict](#t=6042), [dataclass](#t=6337)).

| Schema | Validate lúc chạy | Kết quả trả về | Dùng khi |
|---|---|---|---|
| Pydantic `BaseModel` | Có (kiểu, `Field(ge, le)`, validator) | Object Pydantic | Cần đảm bảo dữ liệu đúng |
| `TypedDict` | Không | `dict` | Chỉ cần gợi ý kiểu, nhẹ |
| `dataclass` | Không | Object dataclass | Code thuần Python, không thêm dependency |
| JSON Schema | Tùy provider | `dict` | Chia sẻ schema giữa ngôn ngữ |

## Trong agent: `response_format`

```python
from langchain.agents import create_agent

class ContactInfo(BaseModel):
    name: str
    email: str
    phone: str

agent = create_agent(model="openai:gpt-4o-mini", tools=[], response_format=ContactInfo)
out = agent.invoke({"messages": [{"role": "user", "content": "John Doe, john@example.com, (555) 123-4567"}]})
print(out["structured_response"])
```

## Khi model trả sai

Provider hỗ trợ native structured output (JSON schema mode) giảm lỗi rất nhiều, nhưng vẫn cần chiến lược khi dữ liệu sai *về nghiệp vụ* (ví dụ `days = 40`):

```flow
Gọi model -> Parse JSON
Parse JSON -> Validate schema + nghiệp vụ
Validate schema + nghiệp vụ -> OK: trả object
Validate schema + nghiệp vụ -> Lỗi: gửi lỗi lại cho model
Lỗi: gửi lỗi lại cho model -> Gọi model
```

Giới hạn số lần retry; hết lượt thì báo lỗi rõ ràng thay vì trả dữ liệu rác.

**Lỗi thường gặp**

- Dùng `TypedDict` rồi tin rằng dữ liệu đã được kiểm tra — không có validate lúc chạy.
- `bool` lọt qua kiểm tra `int` (`isinstance(True, int)` là `True`).
- Schema không có `description` → model đoán ý nghĩa trường.

```selfcheck
Q: Bạn cần đảm bảo `rating` nằm trong 0–10 và báo lỗi nếu sai. Chọn schema nào?
A: Pydantic với `Field(ge=0, le=10)`; TypedDict và dataclass không validate lúc chạy.
Q: Khi dùng `response_format` trong `create_agent`, kết quả structured nằm ở đâu?
A: Ở khóa `structured_response` của kết quả `agent.invoke(...)`.
```

<!-- lesson: lc-middleware -->
## Middleware là gì

Middleware cho phép chèn logic **trước/sau mỗi lần gọi model hoặc tool** trong vòng lặp agent mà không viết lại agent. Video so sánh với việc đi qua các trạm kiểm tra trước khi tới cửa ra máy bay.

```flow
User input -> before_model hooks
before_model hooks -> Model
Model -> after_model hooks
after_model hooks -> Tool (có thể bị chặn chờ duyệt)
Tool (có thể bị chặn chờ duyệt) -> Model
```

## Summarization: hội thoại dài không vỡ context

Mỗi lượt chat gửi lại toàn bộ lịch sử → token tăng dần, chi phí tăng, cuối cùng vượt context window. `SummarizationMiddleware` tóm tắt phần cũ khi chạm ngưỡng ([xem đoạn này](#t=7085)). Video trình bày ba kiểu ngưỡng: theo **số message**, theo **số token** và theo **tỷ lệ context** ([token-based](#t=7920)).

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[],
    middleware=[
        SummarizationMiddleware(
            model="openai:gpt-4o-mini",
            trigger=("messages", 10),   # hoặc ("tokens", 4000) / ("fraction", 0.8)
            keep=("messages", 4),       # giữ nguyên 4 message gần nhất
        )
    ],
    checkpointer=InMemorySaver(),
)
config = {"configurable": {"thread_id": "user-1"}}
```

> Tên tham số của middleware đã thay đổi giữa các bản 1.x (bản cũ dùng `max_tokens_before_summary`, `messages_to_keep`). Kiểm tra docs ứng với phiên bản bạn cài.

## Model fallback

`ModelFallbackMiddleware` thử model dự phòng khi model chính lỗi (hết quota, sập) — ý tưởng sẽ quay lại ở Module 8 với gateway.

## Human-in-the-loop

Với agent tự động gửi email, bạn muốn **dừng lại chờ người duyệt** trước hành động có hậu quả, nhưng không cần duyệt hành động chỉ-đọc ([xem đoạn này](#t=8389)).

```python
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.types import Command

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[read_email, send_email],
    middleware=[HumanInTheLoopMiddleware(interrupt_on={"send_email": True, "read_email": False})],
    checkpointer=InMemorySaver(),      # bắt buộc: phải lưu trạng thái để resume
)
cfg = {"configurable": {"thread_id": "t1"}}
result = agent.invoke({"messages": [{"role": "user", "content": "Send an email to ..."}]}, cfg)
# result["__interrupt__"] chứa yêu cầu duyệt
agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), cfg)   # hoặc "reject" / "edit"
```

| Middleware | Giải quyết | Đánh đổi |
|---|---|---|
| Summarization | Context dài, chi phí | Mất chi tiết của phần đã tóm tắt |
| Model fallback | Provider lỗi | Chất lượng model dự phòng có thể thấp hơn |
| Human-in-the-loop | Hành động rủi ro | Chậm, cần người trực |

**Lỗi thường gặp**

- Bật HITL nhưng không có checkpointer → không thể resume.
- Dùng cùng `thread_id` cho nhiều người dùng → lẫn lịch sử.
- Đặt ngưỡng tóm tắt quá thấp → tóm tắt liên tục, tốn thêm chi phí.

```selfcheck
Q: Vì sao HumanInTheLoopMiddleware bắt buộc phải có checkpointer?
A: Agent dừng giữa chừng; trạng thái phải được lưu theo thread_id để lần gọi `Command(resume=...)` tiếp tục đúng chỗ.
Q: Nên interrupt tool nào: `read_email` hay `send_email`?
A: `send_email` — hành động có tác động ra bên ngoài và không thể hoàn tác; đọc email chỉ đọc dữ liệu.
```
