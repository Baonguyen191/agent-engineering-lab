<!-- lesson: da-concept -->
## Shallow agent

Agent ở các module trước là **shallow agent**: một vòng lặp LLM ⇄ tool ([xem đoạn này](#t=29079)). Nó tốt cho câu hỏi cần vài lượt tool, nhưng gặp khó khi tác vụ dài:

- **Không có kế hoạch**: model quyết định từng bước một, dễ quên mục tiêu ban đầu.
- **Context phình to**: mọi kết quả tool (trang web, tài liệu) đều nằm trong messages → đắt, chậm, model "lạc".
- **Một model làm mọi việc**: không có chuyên môn hóa.

Ví dụ trong video: "Lên kế hoạch kỳ nghỉ ở Paris với ngân sách 100k rupee" — cần tìm vé, khách sạn, lịch trình, kiểm tra ngân sách; một vòng lặp đơn giản dễ làm dở dang.

## Deep agent: 4 thành phần

Các sản phẩm như deep research của ChatGPT, Claude Code hay Manus dùng cùng một công thức, được thư viện `deepagents` đóng gói:

```flow
Deep agent -> Planning tool (todo list)
Deep agent -> Filesystem (ghi / đọc file)
Deep agent -> Subagents (chuyên trách, context riêng)
Deep agent -> System prompt chi tiết
```

| Thành phần | Giải quyết | Ví dụ |
|---|---|---|
| **Planning tool** | Mất phương hướng | `write_todos`: danh sách việc, cập nhật trạng thái |
| **Filesystem** | Context phình to | Ghi kết quả tìm kiếm ra `research/paris.md`, chỉ đọc lại khi cần ([xem đoạn này](#t=29534)) |
| **Subagent** | Một model làm mọi thứ | Subagent "researcher" có context riêng, trả về bản tóm tắt ([xem đoạn này](#t=29739)) |
| **System prompt chi tiết** | Hành vi không nhất quán | Hướng dẫn cách lập kế hoạch, khi nào dùng subagent, định dạng báo cáo |

## Vì sao filesystem quản lý context

```flow
Tool trả 20 trang web -> Ghi ra file
Ghi ra file -> Messages chỉ giữ đường dẫn + tóm tắt
Messages chỉ giữ đường dẫn + tóm tắt -> Đọc lại đúng file khi viết báo cáo
```

Context window là "RAM" của model, filesystem là "ổ cứng". Đưa dữ liệu lớn ra ngoài giúp mỗi lượt gọi model gọn và rẻ.

**Lỗi tư duy thường gặp**

- Dùng deep agent cho câu hỏi đơn giản → chậm và tốn kém không cần thiết.
- Nghĩ subagent luôn tốt hơn — mỗi subagent là thêm lượt gọi LLM; chỉ dùng khi cần cô lập context hoặc chuyên môn hóa.

```selfcheck
Q: Agent nghiên cứu đọc 30 trang web và bắt đầu trả lời lạc đề. Thành phần nào của deep agent giúp nhất?
A: Filesystem (lưu kết quả ra file thay vì giữ trong context) và subagent (nghiên cứu trong context riêng, trả về tóm tắt).
Q: Planning tool khác gì việc model "nghĩ từng bước"?
A: Kế hoạch được ghi thành todo có trạng thái, tồn tại xuyên suốt tác vụ và được cập nhật — không biến mất trong chuỗi suy nghĩ của một lượt.
```

<!-- lesson: da-build -->
## Chuẩn bị

Video tạo dự án bằng `uv`, cài `deepagents`, `tavily-python`, và nạp key của Groq/Tavily từ `.env`.

```bash
uv add deepagents tavily-python python-dotenv langchain-groq
```

## Tool tìm kiếm web

```python
import os
from typing import Literal
from tavily import TavilyClient

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search"""
    return tavily_client.search(query, max_results=max_results, include_raw_content=include_raw_content, topic=topic)
```

Video xây đúng hàm này với các tham số `max_results`, `topic` ([xem đoạn này](#t=30498)).

## Tạo deep agent

```python
from deepagents import create_deep_agent

research_instructions = """You are an expert researcher. Your job is to conduct thorough research
and then write a polished report. Use internet_search to gather information."""

agent = create_deep_agent(
    model="groq:qwen/qwen3-32b",        # hoặc một chat model object
    tools=[internet_search],
    system_prompt=research_instructions,
)

result = agent.invoke({"messages": [{"role": "user", "content": "What is LangGraph?"}]})
print(result["messages"][-1].content)
print(list(result.get("files", {}).keys()))   # các file agent đã ghi trong filesystem ảo
```

Video gặp lỗi tham số `models` vs `model` khi tạo agent ([xem đoạn này](#t=30872)) — một nhắc nhở rằng API thay đổi giữa các phiên bản; đọc thông báo lỗi và docs. Bản cũ dùng `instructions=`, bản mới dùng `system_prompt=`.

## `create_agent` vs `create_deep_agent`

| | `create_agent` | `create_deep_agent` |
|---|---|---|
| Tool có sẵn | Không | `write_todos`, `ls`, `read_file`, `write_file`, `edit_file`, `task` (gọi subagent) |
| System prompt | Của bạn | Của bạn + prompt dài hướng dẫn planning/filesystem |
| Phù hợp | Tác vụ ngắn | Nghiên cứu, viết báo cáo, coding nhiều bước |

## Thêm subagent

```python
critique_subagent = {
    "name": "critique-agent",
    "description": "Critiques the final report and suggests improvements.",
    "system_prompt": "You are a strict editor. Point out missing sources and weak arguments.",
}
agent = create_deep_agent(model=..., tools=[internet_search], system_prompt=research_instructions,
                          subagents=[critique_subagent])
```

Agent chính gọi subagent qua tool `task`; subagent chạy với context riêng và chỉ trả về kết quả cuối.

**Đầu ra mẫu** (rút gọn) khi hỏi "What is LangGraph?" ([xem đoạn invoke](#t=31296)): messages chứa lời gọi `write_todos`, vài lời gọi `internet_search`, `write_file("final_report.md", ...)`, và câu trả lời cuối; `files` chứa file báo cáo ([xem đoạn này](#t=31440)).

**Lỗi thường gặp**

- Quên key Tavily → tool lỗi; deep agent vẫn chạy nhưng báo cáo nghèo nàn.
- Kỳ vọng `files` là file thật trên đĩa — mặc định là filesystem ảo trong state.
- Dùng model yếu: deep agent đòi hỏi model tuân thủ chỉ dẫn và tool calling tốt.

```selfcheck
Q: Sau khi deep agent chạy xong, tìm báo cáo nó đã viết ở đâu?
A: Trong `result["files"]` — filesystem ảo nằm trong state của agent (trừ khi cấu hình backend lưu ra đĩa).
Q: Agent chính giao việc cho subagent bằng cách nào?
A: Gọi tool `task` với tên subagent và mô tả nhiệm vụ; subagent chạy trong context riêng và trả về kết quả.
```

<!-- lesson: da-patterns -->
> Bài bổ sung: các mẫu thiết kế giúp deep agent chạy ổn định trong thực tế. Bài lab **Planner + todo list + virtual filesystem** cài đặt chúng trong code thuần.

## 1. Task decomposition & todo management

Chia mục tiêu lớn thành việc nhỏ **kiểm tra được**, có phụ thuộc và trạng thái:

```text
[done]        research_weather
[done]        research_sights
[in_progress] draft_itinerary     (depends: weather, sights)
[pending]     budget_check        (depends: draft)
[blocked]     final_report        (depends: draft, budget)  ← budget lỗi
```

Trạng thái rõ ràng cho phép: hiển thị tiến độ cho người dùng, tiếp tục sau khi dừng, biết chính xác bước nào hỏng.

## 2. Context management

| Kỹ thuật | Cách làm |
|---|---|
| Offload | Ghi dữ liệu lớn ra file, giữ đường dẫn trong context |
| Summarize | Tóm tắt kết quả cũ (SummarizationMiddleware) |
| Isolate | Subagent có context riêng, chỉ trả tóm tắt |
| Select | Chỉ đọc lại file cần cho bước hiện tại |

## 3. Long-running tasks & recovery

```flow
Bước lỗi -> Retry có giới hạn
Retry có giới hạn -> Vẫn lỗi: đánh dấu failed + lý do
Vẫn lỗi: đánh dấu failed + lý do -> Bước phụ thuộc: blocked
Bước phụ thuộc: blocked -> Báo cáo một phần + hỏi người dùng
```

- **Persistent state**: dùng checkpointer bền để tiếp tục sau khi process chết (Module 2).
- **Idempotent steps**: chạy lại một bước không gây hại.
- **Không retry vô hạn**; ghi lại lỗi để người hoặc planner quyết định.

## 4. Approval

Đặt điểm duyệt ở: kế hoạch ban đầu (trước khi tiêu tốn nhiều token), hành động tốn tiền (đặt vé), hành động không thể hoàn tác (gửi email, xóa dữ liệu). Kết hợp `interrupt` (Module 2) hoặc `HumanInTheLoopMiddleware` (Module 1).

**Lỗi thường gặp**

- Kế hoạch quá chi tiết ngay từ đầu → cứng nhắc; nên cho phép cập nhật todo khi có thông tin mới.
- Bước phụ thuộc vẫn chạy khi bước trước lỗi → kết quả sai lan truyền.

```selfcheck
Q: Bước "check budget" lỗi sau 2 lần retry. Bước "final report" phụ thuộc nó nên ở trạng thái nào?
A: blocked — không chạy để tránh báo cáo dựa trên dữ liệu thiếu; báo lỗi rõ ràng cho người dùng/planner.
Q: Nêu hai thời điểm nên đặt human approval trong deep agent.
A: Sau khi lập kế hoạch (trước khi tốn nhiều chi phí) và trước hành động không thể hoàn tác như đặt vé, gửi email.
```
