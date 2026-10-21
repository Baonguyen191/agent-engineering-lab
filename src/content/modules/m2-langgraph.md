<!-- lesson: lg-overview-components -->
## Vì sao cần graph?

Agent ở Module 1 là một vòng lặp do model điều khiển. Nhiều ứng dụng thực tế lại là **quy trình nhiều bước** với nhánh rẽ, vòng lặp kiểm tra, bước cần người duyệt và trạng thái phải giữ qua nhiều lượt. Viết bằng `if/while` thuần thì khó theo dõi, khó tạm dừng và khó khôi phục. LangGraph mô hình hóa quy trình thành **đồ thị có trạng thái**.

## Ba thành phần

| Thành phần | Là gì | Trong code |
|---|---|---|
| **State** | Dữ liệu dùng chung, đi qua mọi node | `TypedDict` / Pydantic / dataclass |
| **Node** | Một bước xử lý: nhận state, trả **phần cập nhật** | Hàm Python `def node(state) -> dict` |
| **Edge** | Quyết định node nào chạy tiếp | `add_edge`, `add_conditional_edges` |

`START` và `END` là hai node đặc biệt đánh dấu điểm vào và điểm kết thúc.

## Ví dụ trong video: video YouTube → bài blog

Video minh họa bằng bài toán của chính tác giả ([xem đoạn này](#t=10032)): mỗi khi đăng video, lấy transcript rồi sinh nội dung blog.

```flow
START -> Lấy transcript
Lấy transcript -> Sinh nội dung blog
Sinh nội dung blog -> END
```

State chứa `video_url`, `transcript`, `blog` — node sau đọc được kết quả của node trước vì tất cả cùng ghi vào một state.

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

class BlogState(TypedDict):
    video_url: str
    transcript: str
    blog: str

def get_transcript(state: BlogState) -> dict:
    return {"transcript": fetch_transcript(state["video_url"])}   # chỉ trả phần thay đổi

def write_blog(state: BlogState) -> dict:
    return {"blog": llm.invoke(f"Write a blog from: {state['transcript']}").content}

builder = StateGraph(BlogState)
builder.add_node("get_transcript", get_transcript)
builder.add_node("write_blog", write_blog)
builder.add_edge(START, "get_transcript")
builder.add_edge("get_transcript", "write_blog")
builder.add_edge("write_blog", END)
graph = builder.compile()

result = graph.invoke({"video_url": "https://youtu.be/..."})
print(result["blog"])
```

Điểm quan trọng: **node trả về dict chỉ chứa các key muốn cập nhật**, không phải toàn bộ state. LangGraph tự gộp phần cập nhật vào state.

## Graph vs chain vs agent

| | Chain tuyến tính | LangGraph workflow | Agent (create_agent) |
|---|---|---|---|
| Luồng | Cố định A→B→C | Do bạn thiết kế: nhánh, vòng, song song | Model tự quyết |
| Trạng thái | Truyền qua output | State dùng chung, có checkpoint | Danh sách messages |
| Tạm dừng / resume | Không | Có (interrupt) | Có (qua middleware, chạy trên LangGraph) |
| Khi nào dùng | Pipeline đơn giản | Quy trình nghiệp vụ cần kiểm soát | Câu hỏi mở cần chọn tool |

> `create_agent` của LangChain v1 thực chất được xây trên LangGraph — hiểu LangGraph giúp bạn debug agent.

**Lỗi thường gặp**

- Node trả về toàn bộ state hoặc `None` khi lẽ ra phải cập nhật — dễ ghi đè nhầm.
- Quên `add_edge(START, ...)` → lỗi "graph must have an entrypoint".
- Gọi `builder.invoke` thay vì `graph = builder.compile()` rồi `graph.invoke`.

```selfcheck
Q: Node `write_blog` cần đọc transcript do node trước tạo ra. Dữ liệu được truyền thế nào?
A: Qua state dùng chung: node trước trả `{"transcript": ...}`, LangGraph gộp vào state, node sau đọc `state["transcript"]`.
Q: Quy trình có bước "nếu bài viết quá ngắn thì viết lại" — cần thành phần nào?
A: Conditional edge tạo vòng lặp quay lại node viết, kèm điều kiện dừng (ví dụ tối đa 3 lần).
```

<!-- lesson: lg-state-chatbot -->
## State schema và reducer

Khi chatbot nhận tin nhắn mới, ta muốn **nối thêm** vào lịch sử chứ không thay thế. Mặc định, giá trị node trả về **ghi đè** key tương ứng. **Reducer** thay đổi cách cập nhật đó ([xem đoạn add_messages](#t=10809)).

```python
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]   # reducer: nối (và cập nhật theo id)
```

| Không có reducer | Có `add_messages` |
|---|---|
| `[Hi]` + update `[Hello]` → `[Hello]` | `[Hi]` + update `[Hello]` → `[Hi, Hello]` |
| Lịch sử bị mất | Lịch sử được giữ, message cùng id được thay thế |

Reducer là hàm `(giá_trị_cũ, giá_trị_mới) -> giá_trị_kết_quả`. `operator.add` cũng là reducer phổ biến cho list.

## Chatbot một node

Video dùng LLM của Groq ([console.groq.com](https://console.groq.com) để lấy key):

```python
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END

llm = init_chat_model("groq:llama-3.3-70b-versatile")

def chatbot(state: State) -> dict:
    return {"messages": [llm.invoke(state["messages"])]}

builder = StateGraph(State)
builder.add_node("chatbot", chatbot)
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)
graph = builder.compile()

out = graph.invoke({"messages": [{"role": "user", "content": "Hi"}]})
print(out["messages"][-1].content)

for event in graph.stream({"messages": [{"role": "user", "content": "Hi"}]}):
    for node, update in event.items():
        print(node, "->", update["messages"][-1].content)
```

```flow
START -> chatbot (LLM)
chatbot (LLM) -> END
```

**Đầu ra mẫu**: `out["messages"]` gồm `HumanMessage("Hi")` và `AIMessage(...)` — message của người dùng được `add_messages` chuyển từ dict thành object.

**Lỗi thường gặp**

- Node trả `{"messages": llm.invoke(...)}` (một object) — `add_messages` chấp nhận cả object lẫn list, nhưng reducer tự viết thường chỉ chấp nhận list. Nhất quán dùng list.
- Hai node chạy song song cùng ghi một key không có reducer → `InvalidUpdateError`.
- Quên `compile()`.

```selfcheck
Q: Nếu bỏ `Annotated[..., add_messages]`, lượt chat thứ hai sẽ thấy gì trong `state["messages"]`?
A: Chỉ còn message mới nhất vì giá trị bị ghi đè — model mất ngữ cảnh hội thoại.
Q: Viết reducer cho key `total_cost` để cộng dồn chi phí từ mọi node.
A: `total_cost: Annotated[float, operator.add]` — mỗi node trả `{"total_cost": cost_của_node}`.
```

<!-- lesson: lg-tools-react -->
## LLM biết dùng tool trong graph

Chatbot thuần không trả lời được "tin AI mới nhất hôm nay" vì không có dữ liệu thời gian thực. Video gắn tool tìm kiếm web và tool tính toán (`multiply`) vào LLM.

```python
from langgraph.prebuilt import ToolNode, tools_condition

tools = [search_tool, multiply]
llm_with_tools = llm.bind_tools(tools)

def tool_calling_llm(state: State) -> dict:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools))       # tự chạy tool_calls, trả ToolMessage
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges("tool_calling_llm", tools_condition)   # có tool_calls -> "tools", không -> END
builder.add_edge("tools", END)                   # phiên bản 1: dừng sau khi gọi tool
graph = builder.compile()
```

[`ToolNode`](#t=13094) thực thi mọi tool call trong message cuối và trả về `ToolMessage`. [`tools_condition`](#t=13223) là hàm route: nếu message cuối có `tool_calls` thì đi tới node `"tools"`, ngược lại tới `END`.

## Vấn đề và cách sửa: ReAct

Với `tools → END`, graph dừng ngay sau khi tool chạy — câu trả lời cuối là **ToolMessage thô**, và câu hỏi cần nhiều bước ("tìm tin AI rồi nhân 5 với 10") chỉ được xử lý một nửa. Sửa bằng một cạnh quay lại ([xem đoạn ReAct](#t=14134)):

```python
builder.add_edge("tools", "tool_calling_llm")   # thay cho tools -> END
```

```flow
START -> tool_calling_llm
tool_calling_llm -> tools
tools -> tool_calling_llm
tool_calling_llm -> END
```

Đây là vòng lặp **ReAct** (Reason + Act): suy luận → hành động → quan sát → suy luận tiếp, cho tới khi model không gọi tool nữa.

| Cấu hình | Tool chạy | Ai viết câu trả lời cuối | Câu hỏi nhiều bước |
|---|---|---|---|
| `tools → END` | 1 lượt | Không ai (ToolMessage) | Không |
| `tools → llm` (ReAct) | Nhiều lượt | LLM | Có |

**Lỗi thường gặp**

- Tên node tool không phải `"tools"` nhưng dùng `tools_condition` mặc định → route tới node không tồn tại.
- Vòng ReAct không giới hạn → dùng `recursion_limit` trong config (`graph.invoke(inp, {"recursion_limit": 10})`).
- Tool trả object lớn làm phình context → tóm tắt hoặc cắt kết quả.

```selfcheck
Q: Graph có cạnh `tools -> END`. Hỏi "5 nhân 10 rồi cộng 3" thì chuyện gì xảy ra?
A: Chỉ phép tính đầu được thực hiện và graph dừng với ToolMessage; cần cạnh `tools -> tool_calling_llm` để LLM tiếp tục gọi tool và trả lời.
Q: `tools_condition` trả về giá trị nào?
A: `"tools"` khi message cuối có tool_calls, ngược lại `END` (`"__end__"`).
```

<!-- lesson: lg-memory-streaming -->
## Memory = checkpointer + thread_id

Graph mặc định không nhớ gì giữa các lần `invoke`. Video hỏi "tên tôi là gì?" sau khi đã giới thiệu — chatbot quên. Giải pháp: **checkpointer** lưu state sau mỗi bước, gắn với một **thread** ([xem đoạn MemorySaver](#t=14592)).

```python
from langgraph.checkpoint.memory import MemorySaver   # bản mới: InMemorySaver

graph = builder.compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": "1"}}

graph.invoke({"messages": [{"role": "user", "content": "Hi, my name is Krish"}]}, config)
out = graph.invoke({"messages": [{"role": "user", "content": "What is my name?"}]}, config)
print(out["messages"][-1].content)     # "...your name is Krish"
```

Đổi sang `thread_id: "2"` là một cuộc hội thoại mới hoàn toàn.

| Checkpointer | Lưu ở đâu | Dùng khi |
|---|---|---|
| `InMemorySaver` / `MemorySaver` | RAM của process | Học, test, notebook |
| `SqliteSaver` | File SQLite | App một máy, demo |
| `PostgresSaver` | PostgreSQL | Production, nhiều instance |

Checkpointer còn cho phép `graph.get_state(config)` (xem state hiện tại), `get_state_history` (các bước trước) và **resume** sau interrupt hoặc lỗi.

## Streaming: `values` vs `updates`

Video so sánh hai chế độ ([xem đoạn này](#t=15326)):

```python
for chunk in graph.stream(inp, config, stream_mode="updates"):
    print(chunk)   # {"chatbot": {"messages": [AIMessage(...)]}} — chỉ phần node vừa cập nhật

for chunk in graph.stream(inp, config, stream_mode="values"):
    print(chunk)   # {"messages": [...toàn bộ...]} — toàn bộ state sau mỗi bước
```

| Mode | Mỗi chunk chứa | Hợp với |
|---|---|---|
| `updates` | Tên node + phần cập nhật | Hiển thị tiến trình từng bước, log |
| `values` | Toàn bộ state | Debug, UI cần state đầy đủ |
| `messages` | Token LLM khi đang sinh | Hiệu ứng gõ chữ trong chat |

**Lỗi thường gặp**

- Dùng `InMemorySaver` trên server nhiều worker → mỗi worker có memory riêng, người dùng "mất trí nhớ" ngẫu nhiên.
- Tạo `thread_id` mới cho mỗi request → không bao giờ nhớ.
- Lịch sử dài vô hạn → kết hợp tóm tắt/cắt bớt messages.

```selfcheck
Q: Cùng một graph có checkpointer, hai người dùng dùng chung `thread_id="default"`. Hậu quả?
A: Họ chia sẻ cùng một lịch sử hội thoại — rò rỉ dữ liệu giữa người dùng.
Q: Muốn hiển thị "Đang tìm kiếm… / Đang viết…" theo từng node, chọn stream mode nào?
A: `updates`, vì mỗi chunk cho biết node nào vừa chạy xong.
```

<!-- lesson: lg-hitl -->
## Khi agent cần hỏi con người

Một số quyết định không nên để model tự làm: phê duyệt chi tiêu, gửi email cho khách, xin ý kiến chuyên gia. Video xây tool `human_assistance` để chatbot "nhờ người hỗ trợ" ([xem đoạn này](#t=15651)).

```python
from langchain_core.tools import tool
from langgraph.types import interrupt, Command

@tool
def human_assistance(query: str) -> str:
    """Request assistance from a human expert."""
    human_response = interrupt({"query": query})   # graph dừng tại đây
    return human_response["data"]

# ... thêm vào tools, compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": "1"}}
graph.invoke({"messages": [{"role": "user", "content": "I need expert guidance for building an AI agent"}]}, config)
print(graph.get_state(config).next)           # ('tools',) — đang chờ

graph.invoke(Command(resume={"data": "We recommend LangGraph for reliable agents."}), config)
```

```flow
User -> LLM gọi human_assistance
LLM gọi human_assistance -> interrupt: lưu checkpoint, trả về
interrupt: lưu checkpoint, trả về -> Con người trả lời
Con người trả lời -> Command(resume=...)
Command(resume=...) -> Tool trả kết quả cho LLM
```

## Cơ chế quan trọng

1. `interrupt(payload)` dừng graph và trả `payload` ra ngoài (trong kết quả có `__interrupt__`).
2. Trạng thái được lưu nhờ checkpointer — **bắt buộc** phải có.
3. Khi resume, **node chứa interrupt được chạy lại từ đầu**; lần này `interrupt()` trả về giá trị resume.

Hệ quả của (3): code đặt **trước** `interrupt()` trong cùng node sẽ chạy hai lần. Đừng đặt side effect (gửi email, ghi DB) trước `interrupt()`.

| Mẫu | Ví dụ |
|---|---|
| Duyệt / từ chối | Duyệt booking > 500 USD |
| Sửa tham số | Người sửa nội dung email trước khi gửi |
| Hỏi thêm thông tin | Agent hỏi ngày đi khi khách quên nói |

**Lỗi thường gặp**

- Không có checkpointer → không resume được.
- Resume với `thread_id` khác → "Nothing to resume".
- Side effect trước `interrupt()` chạy lặp.

```selfcheck
Q: Vì sao không nên gọi `send_email()` ở dòng ngay trước `interrupt()` trong cùng node?
A: Khi resume, node chạy lại từ đầu nên email sẽ bị gửi lần thứ hai.
Q: Làm sao biết graph đang chờ ở node nào?
A: `graph.get_state(config).next` trả về tuple tên node sẽ chạy tiếp.
```

<!-- lesson: lg-mcp -->
## MCP là gì

**Model Context Protocol** là chuẩn mở để ứng dụng LLM kết nối với tool và nguồn dữ liệu. Thay vì mỗi framework tự viết tích hợp cho mỗi dịch vụ, dịch vụ cung cấp một **MCP server**; mọi **MCP client** (Claude Desktop, IDE, agent LangGraph của bạn) đều dùng được ([xem đoạn mở đầu](#t=16058)).

```flow
Agent (MCP client) -> MCP server: math (stdio)
Agent (MCP client) -> MCP server: weather (HTTP)
MCP server: weather (HTTP) -> API thời tiết bên thứ ba
```

## Viết MCP server bằng FastMCP

```python
# math_server.py — chạy như subprocess, giao tiếp qua stdin/stdout
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two numbers"""
    return a * b

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

```python
# weather.py — server chạy riêng, client kết nối qua HTTP
mcp = FastMCP("Weather")

@mcp.tool()
async def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"It's always raining in {location}"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")   # mặc định http://localhost:8000/mcp
```

Trong video, `weather.py` được chạy trong một terminal riêng trước khi client kết nối ([xem đoạn này](#t=17220)).

## Client: đưa tool MCP vào agent

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent

async def main():
    client = MultiServerMCPClient({
        "math": {"command": "python", "args": ["math_server.py"], "transport": "stdio"},
        "weather": {"url": "http://localhost:8000/mcp", "transport": "streamable_http"},
    })
    tools = await client.get_tools()
    agent = create_agent("groq:qwen/qwen3-32b", tools)
    r = await agent.ainvoke({"messages": [{"role": "user", "content": "what's (3 + 5) x 12?"}]})
    print(r["messages"][-1].content)

asyncio.run(main())
```

| Transport | Server chạy | Dùng khi |
|---|---|---|
| `stdio` | Subprocess do client khởi động | Tool cục bộ, CLI, desktop app |
| `streamable_http` | Service độc lập qua HTTP | Tool dùng chung, triển khai từ xa |

**Lỗi thường gặp**

- Gọi `client.get_tools()` không `await` (API bất đồng bộ).
- Quên khởi động server HTTP trước khi client kết nối.
- Đường dẫn script stdio sai (tương đối với thư mục chạy client).

> **Bảo mật**: MCP server bên thứ ba chạy code và nhận dữ liệu của bạn. Mô tả tool cũng là văn bản đưa vào prompt — một server độc hại có thể chèn chỉ dẫn (tool poisoning). Chỉ dùng server tin cậy và giới hạn quyền (xem Module 6).

```selfcheck
Q: Lợi ích chính của MCP so với tự viết tool LangChain cho từng dịch vụ?
A: Một server MCP dùng được cho mọi client hỗ trợ MCP; tích hợp được chuẩn hóa thay vì viết lại cho từng framework.
Q: Server cần chia sẻ cho nhiều agent trên nhiều máy — chọn transport nào?
A: Streamable HTTP; stdio chỉ chạy như subprocess cục bộ của một client.
```

<!-- lesson: lg-advanced -->
> Bài bổ sung: video tập trung vào chatbot, tool, memory, HITL và MCP. Các kỹ thuật dưới đây cần cho workflow production và có trong yêu cầu của lộ trình.

## Song song: fan-out / fan-in

Hai node có cạnh từ cùng một node nguồn sẽ chạy trong **cùng một superstep**. Nếu chúng cùng ghi một key, key đó phải có reducer.

```python
import operator
from typing import Annotated, TypedDict

class S(TypedDict):
    city: str
    research: Annotated[list[str], operator.add]

g = StateGraph(S)
g.add_node("weather", lambda s: {"research": [f"weather in {s['city']}"]})
g.add_node("sights", lambda s: {"research": [f"sights in {s['city']}"]})
g.add_node("plan", plan)
g.add_edge(START, "weather")
g.add_edge(START, "sights")
g.add_edge(["weather", "sights"], "plan")   # chờ cả hai xong mới chạy plan
```

```flow
START -> weather
START -> sights
weather -> plan
sights -> plan
```

Không có reducer → `InvalidUpdateError` (bài lab **Reducer và nhánh song song** cho bạn thấy lỗi này).

## Map-reduce động với `Send`

Khi số nhánh chỉ biết lúc chạy (ví dụ: nghiên cứu từng thành phố trong danh sách), trả về list `Send` từ hàm route:

```python
from langgraph.types import Send

def fan_out(state):
    return [Send("research_city", {"city": c}) for c in state["cities"]]

g.add_conditional_edges(START, fan_out, ["research_city"])
```

## Subgraph

Graph đã compile có thể dùng làm node của graph khác — tách "research" thành module riêng, test riêng:

```python
research_graph = research_builder.compile()
parent.add_node("research", research_graph)   # state chung các key trùng tên
```

## Retry, giới hạn và khôi phục

| Vấn đề | Công cụ |
|---|---|
| API lỗi tạm thời | `builder.add_node("call_api", fn, retry_policy=RetryPolicy(max_attempts=3))` |
| Vòng lặp không dừng | `{"recursion_limit": 25}` + điều kiện dừng trong route |
| Process chết giữa chừng | Checkpointer bền (Postgres) → gọi lại với cùng `thread_id` để chạy tiếp |
| Muốn thử lại từ bước cũ | `get_state_history` → invoke với `checkpoint_id` cũ (time travel) |

**Nguyên tắc thiết kế**

- Mỗi vòng lặp có **hai** điều kiện dừng: thành công và số lần tối đa.
- Node nên **idempotent** (chạy lại không gây hại) vì retry và resume đều chạy lại node.
- Tách bước gọi bên ngoài (API, DB) thành node riêng để retry chính xác chỗ lỗi.

```selfcheck
Q: Bạn cần nghiên cứu N thành phố, N chỉ biết khi chạy. Dùng gì?
A: Hàm route trả về `[Send("research_city", {...}) for ...]` (map-reduce động), kết quả gộp bằng reducer.
Q: Vì sao node nên idempotent trong LangGraph?
A: Retry policy và resume sau interrupt/lỗi đều chạy lại node; node không idempotent sẽ lặp side effect.
```
