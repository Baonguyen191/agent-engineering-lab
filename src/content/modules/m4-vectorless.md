<!-- lesson: vl-concept -->
## Hạn chế của vector RAG với tài liệu có cấu trúc

Vector RAG cắt tài liệu thành chunk rồi tìm chunk "giống" câu hỏi nhất. Với báo cáo tài chính 200 trang, hợp đồng pháp lý hay sổ tay chính sách, cách này gặp vấn đề:

- **Mất ngữ cảnh cấu trúc**: chunk "Được hoàn tiền nếu hủy trước 48 giờ" không còn biết nó thuộc mục *Khách sạn* hay *Vé máy bay*.
- **Giống ≠ liên quan**: đoạn có nhiều từ trùng chưa chắc là đoạn trả lời câu hỏi.
- **Câu hỏi cần nhiều mục**: "So sánh doanh thu Q1 và Q3" cần đọc hai phần cách xa nhau.

## Ý tưởng: dùng mục lục như con người

Khi tìm thông tin trong một cuốn sách dày, ta không đọc ngẫu nhiên các đoạn — ta mở **mục lục**, chọn chương, rồi chọn mục. Vectorless RAG làm điều tương tự ([xem đoạn giới thiệu cây](#t=26163)):

```flow
Tài liệu -> Dựng cây: chương / mục / tiểu mục + tóm tắt
Dựng cây: chương / mục / tiểu mục + tóm tắt -> LLM đọc cây, chọn node
LLM đọc cây, chọn node -> Lấy nội dung node
Lấy nội dung node -> LLM trả lời kèm vị trí trong tài liệu
```

Mỗi node trong cây có: tiêu đề, tóm tắt, phạm vi trang, `node_id`, các node con. Thay vì so khớp vector, **LLM suy luận** node nào chứa câu trả lời — gọi là *reasoning-based retrieval*.

```text
Travel Policy Handbook
├── Flights
│   ├── Booking   — "Book economy class at least 14 days in advance..."
│   └── Refunds   — "Refundable only if cancelled 24 hours before departure..."
├── Hotels
│   ├── Booking   — "Must cost under 120 USD per night..."
│   └── Refunds   — "Refundable if cancelled 48 hours before check-in."
└── Meals
    └── Allowance — "The daily allowance is 40 USD..."
```

Hỏi "Is a hotel refund possible?": vector search trên chunk *không có heading* chỉ thấy hai đoạn "Refundable..." gần giống nhau. Duyệt cây thì đi *Hotels → Refunds* — đúng ngay vì heading mang ngữ cảnh.

## Không có vector, vậy cần gì?

| Thành phần | Vector RAG | Vectorless RAG |
|---|---|---|
| Index | Embedding của chunk | Cây cấu trúc + tóm tắt node |
| Truy xuất | Similarity search | LLM suy luận trên cây |
| Hạ tầng | Vector DB | Chỉ cần lưu cây (JSON) |
| Giải thích được | Điểm số khó hiểu | Đường đi trong cây rõ ràng |

**Lỗi tư duy thường gặp**

- Nghĩ "vectorless" là miễn phí — mỗi lần duyệt cây là một (hoặc vài) lần gọi LLM, và dựng cây cũng dùng LLM.
- Áp dụng cho văn bản không có cấu trúc (chat log, tweet) — cây vô nghĩa ở đó.

> Bài lab **Tree index kiểu PageIndex vs flat retrieval** cho bạn dựng cây từ heading và so sánh hai cách trên cùng bộ câu hỏi.

```selfcheck
Q: Vì sao chunking thông thường làm mất thông tin quan trọng với sổ tay chính sách?
A: Chunk tách khỏi heading nên mất ngữ cảnh "thuộc mục nào"; hai mục khác nhau có thể sinh ra chunk gần như giống hệt.
Q: Trong vectorless RAG, "retrieval" do thành phần nào thực hiện?
A: LLM, bằng cách đọc cấu trúc cây (tiêu đề + tóm tắt) và chọn node liên quan.
```

<!-- lesson: vl-pageindex -->
## PageIndex

Video dùng **PageIndex** — dự án của VectifyAI dựng cây từ PDF ([xem đoạn này](#t=26783)). Theo video, mã nguồn có trên GitHub nhưng dịch vụ API có giới hạn số request miễn phí, và cần API key ([xem đoạn lấy key](#t=26966)).

## Luồng làm việc

```flow
Lấy API key -> Submit PDF
Submit PDF -> Chờ dựng cây (bất đồng bộ)
Chờ dựng cây (bất đồng bộ) -> Lấy tree (node + tóm tắt)
Lấy tree (node + tóm tắt) -> LLM tree search: chọn node_id
LLM tree search: chọn node_id -> Lấy text của node
Lấy text của node -> LLM sinh câu trả lời
```

Theo video, cây được dựng **bất đồng bộ**: với PDF ~50 trang mất khoảng 30–90 giây ([xem đoạn này](#t=27149)). Vì vậy dựng cây là bước ingestion, làm một lần cho mỗi tài liệu.

## Prompt tree search

Phần cốt lõi là prompt cho LLM đọc cây và trả về node cần đọc. Một mẫu tối giản (ý tưởng tương tự notebook):

```python
import json

TREE_SEARCH_PROMPT = """You are given a question and a tree structure of a document.
Each node has a node_id, a title and a summary.
Find all nodes likely to contain the answer.

Question: {question}

Document tree:
{tree}

Reply in JSON: {{"thinking": "<your reasoning>", "node_list": ["<node_id>", ...]}}"""

def tree_search(llm, question: str, tree: list[dict]) -> list[str]:
    compact = json.dumps(strip_text(tree), ensure_ascii=False)   # chỉ gửi title + summary, không gửi toàn văn
    reply = llm.invoke(TREE_SEARCH_PROMPT.format(question=question, tree=compact)).content
    return json.loads(reply)["node_list"]

def answer(llm, question, tree, node_text):
    ids = tree_search(llm, question, tree)
    context = "\n\n".join(node_text[i] for i in ids)
    return llm.invoke(f"Answer using only this context:\n{context}\n\nQuestion: {question}").content
```

Video trình bày hàm sinh câu trả lời theo đúng luồng: tìm kiếm → lấy node_id → lấy nội dung node → đưa cho LLM ([xem đoạn này](#t=27480)).

> API cụ thể của SDK PageIndex có thể thay đổi; hãy đối chiếu README của repo và notebook trong mô tả video trước khi dùng.

## Đầu vào và đầu ra mẫu

```text
Question: "What was the net profit margin in Q3?"
LLM tree search →  {"thinking": "Q3 figures are in 'Financial Results > Q3'; margin is in 'Key Ratios'",
                    "node_list": ["0007", "0012"]}
Answer        →  "Net profit margin in Q3 was 14.2% (Financial Results > Q3, p.18)."
```

**Lỗi thường gặp**

- Gửi cả toàn văn tài liệu trong prompt tree search → mất lợi thế, tốn token. Chỉ gửi tiêu đề + tóm tắt.
- Không validate JSON trả về / node_id không tồn tại → lỗi khi lấy nội dung (áp dụng structured output từ Module 1).
- Gọi dựng cây đồng bộ trong request của người dùng → timeout.

```selfcheck
Q: Vì sao prompt tree search chỉ nên chứa tiêu đề và tóm tắt node?
A: Để LLM chọn node với ít token; toàn văn chỉ được lấy cho các node đã chọn.
Q: Dựng cây cho tài liệu 50 trang mất ~1 phút. Đặt bước này ở đâu trong hệ thống?
A: Ở ingestion (job nền khi tài liệu được tải lên), lưu cây lại; không dựng trong lúc trả lời câu hỏi.
```

<!-- lesson: vl-compare -->
## So sánh trực tiếp

Video kết thúc phần này bằng so sánh hai cách tiếp cận ([xem đoạn khi nào dùng](#t=28677)).

| Tiêu chí | Vector RAG | Vectorless (tree + reasoning) |
|---|---|---|
| Độ chính xác trên tài liệu dài có cấu trúc | Trung bình — mất ngữ cảnh heading | Cao — giữ cấu trúc, suy luận chéo mục |
| Độ trễ mỗi câu hỏi | Thấp (ms cho search) | Cao hơn (thêm lượt gọi LLM) |
| Chi phí | Embedding rẻ, search gần như miễn phí | Mỗi truy vấn tốn token LLM |
| Quy mô | Hàng triệu chunk | Không phù hợp hàng triệu tài liệu |
| Hệ sinh thái | Trưởng thành: nhiều vector DB, công cụ | Mới, ít công cụ |
| Giải thích được | Điểm similarity | Đường đi trong cây + lý do của LLM |

## Chọn thế nào

```flow
Câu hỏi về tài liệu -> Tài liệu dài, có cấu trúc rõ, cần chính xác cao?
Tài liệu dài, có cấu trúc rõ, cần chính xác cao? -> Có: Vectorless / tree
Tài liệu dài, có cấu trúc rõ, cần chính xác cao? -> Không: Vector RAG
```

| Tình huống | Gợi ý |
|---|---|
| Phân tích báo cáo tài chính, hợp đồng, hồ sơ pháp lý | Vectorless |
| Chatbot hỗ trợ khách hàng trên hàng chục nghìn bài viết | Vector |
| Tìm kiếm thời gian thực, độ trễ thấp | Vector |
| Hỏi đáp cần so sánh nhiều mục trong một tài liệu | Vectorless |
| Kho tài liệu lớn, mỗi tài liệu dài | Kết hợp |

## Kiến trúc kết hợp

```flow
Câu hỏi -> Vector search: chọn vài tài liệu ứng viên
Vector search: chọn vài tài liệu ứng viên -> Tree search trong từng tài liệu
Tree search trong từng tài liệu -> LLM tổng hợp câu trả lời
```

Vector search thu hẹp *tài liệu nào*, tree search tìm *mục nào* — tận dụng quy mô của cái này và độ chính xác của cái kia.

**Lỗi thường gặp**

- Chọn công nghệ theo xu hướng thay vì đo trên bộ câu hỏi thật (Module 7).
- Quên tính chi phí LLM cho mỗi truy vấn khi lưu lượng lớn.

```selfcheck
Q: Hệ thống phải trả lời trong 300 ms cho hàng nghìn người dùng đồng thời. Chọn cách nào?
A: Vector RAG — vectorless thêm lượt gọi LLM cho retrieval, khó đạt độ trễ đó và tốn chi phí.
Q: Trong bài lab, vì sao flat retrieval trả lời sai câu "Is a hotel refund possible?"
A: Các chunk lá không chứa từ "hotel" (nằm ở heading), nên hai đoạn Refunds gần như giống nhau với vector; duyệt cây dùng được heading "Hotels".
```
