<!-- lesson: gw-concept -->
## Vấn đề khi gọi trực tiếp nhiều provider

Một ứng dụng thực tế thường dùng nhiều model: GPT cho suy luận, Gemini cho ngữ cảnh dài, Llama trên Groq cho tốc độ. Gọi trực tiếp từng provider dẫn tới:

- Mỗi provider một SDK, một định dạng request/response, một kiểu lỗi.
- Provider sập hoặc hết quota → ứng dụng sập theo.
- Không biết mỗi tính năng/người dùng tốn bao nhiêu tiền.
- API key rải rác trong nhiều service; khó xoay vòng, khó kiểm soát.
- Không có chỗ chung để chặn dữ liệu nhạy cảm trước khi gửi đi.

Video nhấn mạnh: đổi provider lẽ ra chỉ là **thay đổi cấu hình**, không phải viết lại code tích hợp.

## Gateway: một cửa cho mọi model

```flow
Ứng dụng A -> LLM Gateway
Ứng dụng B -> LLM Gateway
LLM Gateway -> OpenAI
LLM Gateway -> Groq
LLM Gateway -> Gemini
```

Theo phần giới thiệu LiteLLM trong video ([xem đoạn này](#t=38660)): một API thống nhất cho hơn 100 provider, fallback tự động, logging tập trung, theo dõi chi phí, rate limit và caching.

| Chức năng | Ý nghĩa |
|---|---|
| Unified API | Một định dạng (kiểu OpenAI) cho mọi provider |
| Routing | Chọn model theo alias, tải, chi phí, loại tác vụ |
| Fallback | Provider chính lỗi → tự chuyển sang provider dự phòng |
| Retry | Thử lại lỗi tạm thời (timeout, 429, 5xx) có backoff |
| Rate limiting | Giới hạn request/token theo người dùng, nhóm, key |
| Usage & cost | Đếm token, tính tiền theo model, đặt ngân sách |
| Caching | Trả kết quả đã có cho request giống hệt, không tốn phí |
| Observability | Log/trace tập trung cho mọi lời gọi |
| Bảo mật | Giữ key thật ở một chỗ, che PII, áp chính sách |

## Thư viện hay proxy?

| | SDK trong code (`litellm.completion`) | Proxy server (LiteLLM Proxy) |
|---|---|---|
| Triển khai | Import trong ứng dụng | Service riêng, ứng dụng gọi qua HTTP kiểu OpenAI |
| Phù hợp | Một ứng dụng, team nhỏ | Nhiều team/ngôn ngữ, cần quản trị key, ngân sách tập trung |
| Key provider | Nằm trong ứng dụng | Chỉ nằm ở proxy; ứng dụng dùng virtual key |

**Lỗi thường gặp**

- Retry cả lỗi 4xx do request sai (400) → tốn tiền, không bao giờ thành công.
- Fallback sang model kém hơn mà không ghi log → chất lượng giảm âm thầm.
- Cache câu trả lời chứa dữ liệu cá nhân rồi trả cho người dùng khác.

> Bài lab **LLM Gateway** cho bạn tự viết phiên bản thu nhỏ với provider mock để kiểm thử mọi kịch bản lỗi mà không cần API key.

```selfcheck
Q: Provider chính trả lỗi 503 liên tục trong 10 phút. Hai chức năng nào của gateway giữ ứng dụng hoạt động?
A: Retry (cho lỗi tạm thời ngắn) và fallback sang provider dự phòng khi hết lượt retry.
Q: Khi nào nên chọn gateway dạng proxy server thay vì SDK?
A: Khi nhiều ứng dụng/team/ngôn ngữ dùng chung, cần quản lý key, ngân sách và chính sách ở một nơi.
```

<!-- lesson: gw-litellm -->
## Một cú pháp cho mọi provider

```python
from litellm import completion

messages = [{"role": "user", "content": "Write a haiku about silent circuits"}]

r1 = completion(model="gpt-4o-mini", messages=messages)                       # OpenAI
r2 = completion(model="groq/llama-3.3-70b-versatile", messages=messages)      # Groq
r3 = completion(model="gemini/gemini-2.0-flash", messages=messages)           # Google

for r in (r1, r2, r3):
    print(r.model, "→", r.choices[0].message.content[:60])
```

Response luôn theo định dạng OpenAI (`choices[0].message.content`, `usage`) dù provider là ai. Video dùng ba API key (OpenAI, Groq, Google) chính để minh họa fallback.

## Fallback và retry

```python
response = completion(
    model="gpt-4o-mini",
    messages=messages,
    fallbacks=["groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    num_retries=2,
)
print("Served by:", response.model)
```

[Xem đoạn fallback](#t=38975) trong video.

## Usage và chi phí

```python
from litellm import completion_cost

r = completion(model="gpt-4o-mini", messages=messages)
print(r.usage.prompt_tokens, r.usage.completion_tokens)
print(f"Cost: ${completion_cost(completion_response=r):.6f}")
```

Video in số token vào/ra và chi phí của từng request ([xem đoạn này](#t=39150)) — nhân với hàng triệu request mỗi tháng để thấy vì sao cần theo dõi.

## Router

`Router` gom nhiều deployment dưới một **alias**, tự cân tải, retry và fallback ([xem đoạn routing strategy](#t=39558)):

```python
import os
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "fast", "litellm_params": {"model": "groq/llama-3.3-70b-versatile", "api_key": os.environ["GROQ_API_KEY"]}},
        {"model_name": "smart", "litellm_params": {"model": "openai/gpt-4o", "api_key": os.environ["OPENAI_API_KEY"]}},
        {"model_name": "smart", "litellm_params": {"model": "openai/gpt-4o-mini", "api_key": os.environ["OPENAI_API_KEY"]}},
    ],
    fallbacks=[{"smart": ["fast"]}],
    routing_strategy="simple-shuffle",      # các lựa chọn khác: latency-based, usage-based...
    num_retries=2,
)
resp = router.completion(model="smart", messages=messages)
```

Hai deployment cùng tên `"smart"` được cân tải; nếu cả hai lỗi thì fallback sang `"fast"`.

## Dùng cùng LangChain

Video ghép LiteLLM vào chain LangChain bằng `ChatPromptTemplate` ([xem đoạn này](#t=39720)):

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_litellm import ChatLiteLLM        # bản cũ: langchain_community.chat_models

prompt = ChatPromptTemplate.from_messages([("system", "You are a concise assistant."), ("user", "{question}")])
chain = prompt | ChatLiteLLM(model="groq/llama-3.3-70b-versatile")
print(chain.invoke({"question": "What is an LLM gateway?"}).content)
```

**Lỗi thường gặp**

- Sai tiền tố provider (`llama-3.3-70b` thay vì `groq/llama-3.3-70b-versatile`) → "LLM Provider NOT provided".
- Fallback sang model có context window nhỏ hơn → lỗi với prompt dài.
- Tin số cost tuyệt đối khi model mới chưa có trong bảng giá của thư viện — kiểm tra lại với hóa đơn.

```selfcheck
Q: Bạn muốn ứng dụng gọi "smart" và để hạ tầng quyết định deployment cụ thể. Dùng thành phần nào của LiteLLM?
A: `Router` với model_list định nghĩa alias "smart" (và fallbacks).
Q: Làm sao biết request được phục vụ bởi model nào sau khi fallback?
A: Đọc `response.model` (và log của gateway).
```

<!-- lesson: gw-router-pii -->
## Smart router: model phù hợp cho từng tác vụ

Không phải câu hỏi nào cũng cần model đắt nhất. Video xây một **smart router** ([xem đoạn này](#t=39878)): phân loại yêu cầu rồi chọn model — ví dụ "viết hàm Python tính Fibonacci" được nhận diện là tác vụ **coding** và chuyển tới model mạnh về code.

```python
ROUTES = {
    "coding": "openai/gpt-4o",
    "general": "groq/llama-3.3-70b-versatile",
    "summarize": "gemini/gemini-2.0-flash",
}

def classify(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ("code", "python", "function", "bug", "sql")):
        return "coding"
    if any(k in q for k in ("summarize", "tóm tắt", "tl;dr")):
        return "summarize"
    return "general"                                   # luôn có nhánh mặc định

def smart_complete(question: str):
    model = ROUTES[classify(question)]
    return completion(model=model, messages=[{"role": "user", "content": question}], fallbacks=[ROUTES["general"]])
```

```flow
Câu hỏi -> Phân loại tác vụ
Phân loại tác vụ -> coding: model mạnh về code
Phân loại tác vụ -> general: model nhanh, rẻ
Phân loại tác vụ -> summarize: model context dài
```

Bộ phân loại có thể là rule (nhanh, miễn phí) hoặc một model nhỏ (chính xác hơn). Đo chất lượng và chi phí của router bằng bộ eval (Module 7).

## Che PII trước khi request rời hệ thống

Gateway là điểm lý tưởng để che dữ liệu nhạy cảm vì mọi request đều đi qua. Video dùng regex cho email, số điện thoại, SSN, Aadhaar, PAN, số thẻ, địa chỉ IP ([xem đoạn này](#t=40196)):

```python
import re

PII_PATTERNS = {
    "EMAIL": r"[\w.+-]+@[\w-]+(\.[\w-]+)+",
    "CARD": r"\b(?:\d[ -]?){15}\d\b",
    "PHONE_VN": r"(?:\+84|\b0)\d{9}\b",
    "IP": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
}

def mask_pii(text: str) -> str:
    for label, pattern in PII_PATTERNS.items():
        text = re.sub(pattern, f"[{label}]", text)
    return text

print(mask_pii("Email an@x.com, thẻ 4111 1111 1111 1111. Viết code Python giúp mình"))
# Email [EMAIL], thẻ [CARD]. Viết code Python giúp mình
```

## Observability

Mỗi lời gọi qua gateway nên sinh một bản ghi có cấu trúc:

| Trường | Ví dụ |
|---|---|
| trace_id, user / team | `t-8f2c`, `team-travel` |
| route / alias, model thực tế | `smart` → `openai/gpt-4o-mini` |
| tokens in/out, cost | 812 / 145, $0.00021 |
| latency, số lần retry, fallback? | 1.8 s, 1, có |
| trạng thái / lỗi | `ok` |

**Không bao giờ** ghi API key, header Authorization, hay prompt chứa PII chưa che. Bài lab **Travel Agent 10 — Tracing** cài đặt tracer có span lồng nhau và tự che secret.

**Lỗi thường gặp**

- Router không có nhánh mặc định → câu hỏi lạ gây lỗi.
- Regex PII chạy sau khi đã log request.
- Log toàn bộ prompt/response ở production mà không có chính sách lưu trữ.

```selfcheck
Q: Vì sao gateway là nơi tốt để che PII?
A: Mọi request tới mọi provider đều đi qua đó — một điểm áp chính sách duy nhất, trước khi dữ liệu rời hệ thống.
Q: Smart router phân loại sai một câu hỏi coding thành "general". Hậu quả và cách phát hiện?
A: Câu trả lời kém chất lượng hơn (model yếu về code). Phát hiện bằng bộ eval có case coding và theo dõi route trong log.
```
