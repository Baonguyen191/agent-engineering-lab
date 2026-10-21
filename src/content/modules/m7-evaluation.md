<!-- lesson: ev-concept -->
## "Trông có vẻ ổn" không phải là đánh giá

Ứng dụng LLM không xác định: cùng câu hỏi, đổi prompt một chữ hay đổi model có thể làm tốt hơn ở 5 câu và tệ hơn ở 10 câu khác. Thử bằng tay vài câu không phát hiện được điều đó. Evaluation biến "cảm giác" thành **số đo lặp lại được**.

## Quy trình

Video bắt đầu từ một chatbot đơn giản và đi từng bước, trong đó bước đầu tiên là **thu thập data point** — cặp input và output mong đợi.

```flow
Thu thập data point (input + output chuẩn) -> Định nghĩa metric / evaluator
Định nghĩa metric / evaluator -> Chạy ứng dụng trên toàn bộ dataset
Chạy ứng dụng trên toàn bộ dataset -> Chấm điểm từng example
Chấm điểm từng example -> So sánh với phiên bản trước
So sánh với phiên bản trước -> Sửa prompt / model / retrieval
```

## Ba loại evaluator

| Loại | Cách chấm | Ví dụ | Khi nào |
|---|---|---|---|
| Exact match | So khớp chính xác | Tool được gọi == `get_weather` | Đầu ra có dạng cố định |
| Rule-based | Code kiểm tra điều kiện | Có chứa "°C", JSON hợp lệ, < 200 từ | Ràng buộc rõ ràng |
| **LLM-as-a-judge** | Một LLM chấm theo rubric | "Câu trả lời có đúng ý với đáp án chuẩn không?" | Câu trả lời tự do |

Video giới thiệu **LLM-as-a-judge** ([xem đoạn này](#t=34120)): dùng một LLM với prompt chấm điểm để so sánh output với đáp án.

## Điểm yếu của LLM-as-a-judge

- Thiên vị: thích câu dài, thích văn phong giống mình, thích đáp án đứng trước.
- Không ổn định nếu prompt mơ hồ → cần **rubric** rõ, temperature 0, structured output (`{"correct": bool, "reason": str}`).
- Tốn chi phí → dùng rule-based khi có thể.
- Cần **kiểm tra lại judge** bằng một mẫu nhỏ do người chấm.

**Lỗi thường gặp**

- Dataset chỉ có case dễ → điểm cao giả tạo.
- Đổi dataset giữa hai lần so sánh → không so sánh được.
- Chỉ nhìn điểm trung bình, không đọc các case thất bại.

```selfcheck
Q: Muốn kiểm tra agent có gọi đúng tool `convert_currency` không. Dùng loại evaluator nào?
A: Exact match / rule-based — đầu ra (tên tool) có dạng cố định, không cần LLM judge.
Q: Nêu hai cách làm LLM-as-a-judge ổn định hơn.
A: Rubric cụ thể + temperature 0 + structured output; và đối chiếu judge với một mẫu do người chấm.
```

<!-- lesson: ev-langsmith -->
## LangSmith

LangSmith là nền tảng observability và evaluation của LangChain. Video đăng ký tài khoản, lấy API key và dùng SDK `langsmith`.

## Tạo dataset

```python
from langsmith import Client

client = Client()   # đọc LANGSMITH_API_KEY từ môi trường

dataset = client.create_dataset(dataset_name="Simple chatbot eval", description="Q&A about LangChain")
client.create_examples(
    dataset_id=dataset.id,
    examples=[
        {"inputs": {"question": "What is LangChain?"},
         "outputs": {"answer": "A framework for building LLM applications."}},
        {"inputs": {"question": "What is LangSmith?"},
         "outputs": {"answer": "A platform for observing and evaluating LLM applications."}},
    ],
)
```

Mỗi **example** là một hàng: `inputs` (đầu vào) và `outputs` (đầu ra mong đợi). Video cũng chỉ ra có thể nạp từ CSV/Excel ([xem đoạn tạo dataset](#t=34542)).

## Ứng dụng cần đánh giá

```python
from langsmith.wrappers import wrap_openai
import openai

oa = wrap_openai(openai.OpenAI())   # mọi lời gọi được trace lên LangSmith

def my_app(question: str, model: str = "gpt-4o-mini", instructions: str = "Respond in one sentence.") -> str:
    r = oa.chat.completions.create(model=model, temperature=0,
                                   messages=[{"role": "system", "content": instructions}, {"role": "user", "content": question}])
    return r.choices[0].message.content

def target(inputs: dict) -> dict:
    return {"answer": my_app(inputs["question"])}
```

## Evaluator

```python
from pydantic import BaseModel
from langchain.chat_models import init_chat_model

class Grade(BaseModel):
    score: bool          # True nếu đúng

judge = init_chat_model("openai:gpt-4o-mini", temperature=0).with_structured_output(Grade)

def correctness(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    prompt = f"""You are a teacher grading a quiz. Is the STUDENT ANSWER correct with respect to the REFERENCE?
QUESTION: {inputs['question']}
REFERENCE: {reference_outputs['answer']}
STUDENT ANSWER: {outputs['answer']}"""
    return judge.invoke(prompt).score

def concision(outputs: dict, reference_outputs: dict) -> bool:
    return len(outputs["answer"]) < 2 * len(reference_outputs["answer"])   # rule-based
```

Video định nghĩa đúng hai evaluator này: **correctness** (LLM judge) và **concision** (rule).

## Chạy experiment và so sánh

```python
results = client.evaluate(
    target,
    data="Simple chatbot eval",
    evaluators=[correctness, concision],
    experiment_prefix="gpt-4o-mini, one sentence",
)
# đổi prompt/model rồi chạy experiment thứ hai với prefix khác để so sánh trên UI
```

Trên giao diện LangSmith, mỗi **experiment** là một lần chạy trên toàn bộ dataset; có thể so sánh hai experiment theo từng example ([xem đoạn này](#t=35555)).

| Khái niệm | Nghĩa |
|---|---|
| Dataset | Tập example cố định |
| Example | inputs + outputs mong đợi |
| Target | Hàm ứng dụng cần đánh giá |
| Evaluator | Hàm chấm điểm một example |
| Experiment | Một lần chạy target + evaluators trên dataset |

**Lỗi thường gặp**

- Evaluator đặt tên tham số sai (`reference` thay vì `reference_outputs`) → không nhận được dữ liệu.
- Judge không có structured output → phải parse text, dễ lỗi.
- Dataset bị sửa giữa các experiment → so sánh vô nghĩa (dùng version/tag của dataset).

```selfcheck
Q: Vì sao concision có thể viết bằng code nhưng correctness thường cần LLM judge?
A: Độ dài đo được bằng rule; "đúng ý với đáp án" cần hiểu ngữ nghĩa vì cùng ý có nhiều cách diễn đạt.
Q: Đổi system prompt từ "one sentence" sang "detailed". Làm sao biết có tốt hơn?
A: Chạy experiment mới trên cùng dataset với cùng evaluators rồi so sánh từng example với experiment cũ.
```

<!-- lesson: ev-rag -->
## Bốn câu hỏi khi đánh giá RAG

Một hệ RAG có 4 thành phần dữ liệu: **câu hỏi**, **tài liệu truy xuất**, **câu trả lời**, **đáp án chuẩn**. Mỗi evaluator so sánh một cặp ([xem phần RAG evaluation](#t=35910)):

```flow
Câu hỏi -> Tài liệu truy xuất
Tài liệu truy xuất -> Câu trả lời
Đáp án chuẩn -> Câu trả lời
```

| Evaluator | So sánh | Trả lời câu hỏi | Cần đáp án chuẩn? |
|---|---|---|---|
| **Correctness** | Câu trả lời ↔ đáp án chuẩn | Có đúng không? | Có |
| **Relevance** | Câu trả lời ↔ câu hỏi | Có trả lời đúng câu được hỏi không? | Không ([xem đoạn này](#t=37290)) |
| **Groundedness** | Câu trả lời ↔ tài liệu truy xuất | Có bịa ngoài tài liệu không? | Không ([xem đoạn này](#t=37389)) |
| **Retrieval relevance** | Tài liệu truy xuất ↔ câu hỏi | Retriever có mang về tài liệu liên quan không? | Không ([xem đoạn này](#t=37461)) |

## Prompt judge mẫu: groundedness

```python
GROUNDED_PROMPT = """You are a teacher grading a quiz.
You will be given FACTS and a STUDENT ANSWER.
Grade criteria:
(1) The STUDENT ANSWER must be grounded in the FACTS.
(2) The STUDENT ANSWER must not contain hallucinated information outside the FACTS.
Return grounded=True only if both criteria are met. Explain your reasoning step by step."""

class GroundedGrade(BaseModel):
    explanation: str
    grounded: bool

def groundedness(inputs: dict, outputs: dict) -> bool:
    facts = "\n\n".join(d.page_content for d in outputs["documents"])
    return grader.with_structured_output(GroundedGrade).invoke(
        [{"role": "system", "content": GROUNDED_PROMPT},
         {"role": "user", "content": f"FACTS: {facts}\nSTUDENT ANSWER: {outputs['answer']}"}]
    ).grounded
```

Lưu ý: để chấm groundedness và retrieval relevance, hàm target phải trả về **cả tài liệu đã truy xuất** (`{"answer": ..., "documents": [...]}`).

## Chẩn đoán từ điểm số

| Retrieval relevance | Groundedness | Correctness | Lỗi nằm ở |
|---|---|---|---|
| Thấp | — | Thấp | **Retrieval**: chunking, embedding, top-k, query |
| Cao | Thấp | Thấp | **Generation**: model bịa, prompt chưa ép dùng context |
| Cao | Cao | Thấp | **Dữ liệu**: tài liệu sai/thiếu, hoặc đáp án chuẩn sai |
| Cao | Cao | Cao | Ổn — mở rộng dataset với case khó hơn |

**Lỗi thường gặp**

- Chỉ đo correctness → không biết sửa retrieval hay prompt.
- Target không trả documents → không chấm được groundedness.
- Judge thấy đáp án chuẩn khi chấm groundedness → lẫn tiêu chí.

```selfcheck
Q: Retrieval relevance cao nhưng groundedness thấp. Sửa ở đâu trước?
A: Generation: siết prompt (chỉ dùng context, cho phép "không biết"), giảm temperature, hoặc đổi model.
Q: Evaluator nào dùng được khi chưa có đáp án chuẩn?
A: Relevance, groundedness và retrieval relevance; correctness thì cần đáp án chuẩn.
```

<!-- lesson: ev-agent -->
> Bài bổ sung: video tập trung vào chatbot và RAG. Agent cần thêm các metric về **hành động**.

## Metric cho agent

| Metric | Định nghĩa | Cách đo |
|---|---|---|
| Tool selection accuracy | Tỷ lệ case gọi đúng tool (kể cả "không gọi tool") | Exact match với tool mong đợi |
| Task success rate | Tỷ lệ case đạt mục tiêu cuối | Rule (must_include, trạng thái DB) hoặc judge |
| Trajectory | Chuỗi bước có hợp lý không (không thừa, không vòng lặp) | So với trajectory chuẩn / judge |
| Latency | p50, p95 thời gian trả lời | Đo từ trace |
| Cost | Token × giá theo model | Từ usage của provider/gateway |
| Safety | Tỷ lệ tấn công bị chặn, tỷ lệ chặn nhầm | Bộ test red-team (Module 6) |

## Regression testing

Một phiên bản mới có thể **tốt hơn trung bình nhưng làm hỏng case cũ**. Bài lab **Bộ evaluation 20 case** cho thấy đúng điều đó: v2 có tool accuracy 0.9 (v1: 0.8) nhưng task success giữ nguyên 0.8 và **4 case từng đúng bị hỏng**.

```python
def regressions(baseline, candidate) -> list[str]:
    after = {r.id: r.success for r in candidate.results}
    return [r.id for r in baseline.results if r.success and not after.get(r.id, False)]
```

```flow
Pull request đổi prompt/model -> Chạy bộ eval
Chạy bộ eval -> So với baseline từng case
So với baseline từng case -> Có regression hoặc dưới ngưỡng? chặn merge
So với baseline từng case -> Không: cho phép phát hành
```

## Thiết kế dataset tốt

- Bao phủ: mỗi tool, case không cần tool, case mơ hồ, case ngoài phạm vi, case tấn công.
- Ưu tiên case **từ lỗi thật** trong production (mỗi bug → một test).
- Giữ dataset có version; chỉ thêm, hạn chế sửa.
- Tách tập dùng để tinh chỉnh prompt và tập kiểm tra cuối (tránh overfit vào bộ test).

**Lỗi thường gặp**

- Một metric tổng duy nhất che giấu regression.
- Không đo cost/latency → phiên bản "chính xác hơn" đắt gấp 3 lần mà không ai biết.

```selfcheck
Q: v2 tăng tool accuracy từ 0.8 lên 0.9 nhưng task success không đổi. Có nên phát hành ngay?
A: Chưa — kiểm tra regression theo từng case; trong bài lab v2 làm hỏng 4 case từng chạy đúng.
Q: Vì sao dataset cần case "không cần gọi tool"?
A: Để phát hiện agent gọi tool thừa (tốn tiền, chậm) hoặc hành động nguy hiểm như đặt phòng khi người dùng chỉ muốn hủy.
```
