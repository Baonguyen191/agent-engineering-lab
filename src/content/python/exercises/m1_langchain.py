# @@lc-structured-output:starter
import json
import re
from dataclasses import dataclass, field

from labkit.llm import assistant, get_chat_model, system, user

SCHEMA_PROMPT = """Extract the trip request as JSON with keys:
destination (string), days (integer 1-30), budget_usd (number > 0), interests (list of strings).
Reply with JSON only."""


@dataclass
class TripRequest:
    destination: str
    days: int
    budget_usd: float
    interests: list[str] = field(default_factory=list)


def extract_json(text: str) -> dict:
    """Return the JSON object inside `text`.
    Accept raw JSON, JSON surrounded by prose, or a ```json fenced block.
    Raise ValueError if there is no valid JSON object."""
    # TODO
    raise NotImplementedError


def parse_trip_request(data: dict) -> TripRequest:
    """Validate `data` and build a TripRequest. Raise ValueError whose message names the bad field.
    - destination: non-empty string (strip spaces)
    - days: int between 1 and 30 (note: True is an int in Python, reject bools)
    - budget_usd: number > 0
    - interests: optional list of strings, default []"""
    # TODO
    raise NotImplementedError


def extract_with_retry(model, text: str, max_retries: int = 2) -> TripRequest:
    """Call the model, validate the reply. On ValueError, append the bad reply and a user
    message containing the error, then call again. Give up with ValueError after
    max_retries retries (max_retries + 1 calls in total)."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    demo = get_chat_model(script=['{"destination": "Đà Nẵng", "days": 3, "budget_usd": 400, "interests": ["beach"]}'])
    print(extract_with_retry(demo, "3 ngày ở Đà Nẵng, ngân sách 400 USD, thích biển"))

# @@lc-structured-output:solution
import json
import re
from dataclasses import dataclass, field

from labkit.llm import assistant, get_chat_model, system, user

SCHEMA_PROMPT = """Extract the trip request as JSON with keys:
destination (string), days (integer 1-30), budget_usd (number > 0), interests (list of strings).
Reply with JSON only."""


@dataclass
class TripRequest:
    destination: str
    days: int
    budget_usd: float
    interests: list[str] = field(default_factory=list)


def extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        candidate = fenced.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end < start:
            raise ValueError("No JSON object found in model output")
        candidate = text[start : end + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e.msg}") from e
    if not isinstance(data, dict):
        raise ValueError("JSON must be an object")
    return data


def parse_trip_request(data: dict) -> TripRequest:
    dest = data.get("destination")
    if not isinstance(dest, str) or not dest.strip():
        raise ValueError("destination must be a non-empty string")
    days = data.get("days")
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 30:
        raise ValueError("days must be an integer between 1 and 30")
    budget = data.get("budget_usd")
    if isinstance(budget, bool) or not isinstance(budget, (int, float)) or budget <= 0:
        raise ValueError("budget_usd must be a number > 0")
    interests = data.get("interests", [])
    if not isinstance(interests, list) or not all(isinstance(i, str) for i in interests):
        raise ValueError("interests must be a list of strings")
    return TripRequest(dest.strip(), days, float(budget), interests)


def extract_with_retry(model, text: str, max_retries: int = 2) -> TripRequest:
    messages = [system(SCHEMA_PROMPT), user(text)]
    last_error = None
    for _ in range(max_retries + 1):
        reply = model.invoke(messages)
        try:
            return parse_trip_request(extract_json(reply.content))
        except ValueError as e:
            last_error = e
            messages += [
                assistant(reply.content),
                user(f"Your previous answer was invalid: {e}. Reply with corrected JSON only."),
            ]
    raise ValueError(f"Failed after {max_retries + 1} attempts: {last_error}")


if __name__ == "__main__":
    demo = get_chat_model(script=['{"destination": "Đà Nẵng", "days": 3, "budget_usd": 400, "interests": ["beach"]}'])
    print(extract_with_retry(demo, "3 ngày ở Đà Nẵng, ngân sách 400 USD, thích biển"))

# @@lc-structured-output:tests
from labkit.llm import MockChatModel


def test_extract_raw_json():
    """extract_json đọc JSON thuần và JSON lẫn trong câu chữ"""
    assert extract_json('{"a": 1}') == {"a": 1}
    assert extract_json('Kết quả: {"a": 1} xong.') == {"a": 1}


def test_extract_fenced_json():
    """extract_json đọc khối ```json"""
    assert extract_json('Here:\n```json\n{"a": 2}\n```') == {"a": 2}


def test_extract_invalid_raises():
    """Không có JSON object hợp lệ -> ValueError"""
    for bad in ["no json here", "{bad json}", "[1, 2]"]:
        try:
            extract_json(bad)
        except ValueError:
            continue
        raise AssertionError(f"extract_json({bad!r}) phải raise ValueError")


def test_parse_valid():
    """parse_trip_request tạo TripRequest đúng và strip destination"""
    r = parse_trip_request({"destination": " Huế ", "days": 2, "budget_usd": 150, "interests": ["food"]})
    assert r == TripRequest("Huế", 2, 150.0, ["food"]), r
    assert parse_trip_request({"destination": "Huế", "days": 1, "budget_usd": 9.5}).interests == []


def test_parse_rejects_bad_fields():
    """Mỗi trường sai phải bị từ chối với thông báo nêu tên trường"""
    cases = [
        ({"destination": "", "days": 2, "budget_usd": 1}, "destination"),
        ({"destination": "X", "days": 0, "budget_usd": 1}, "days"),
        ({"destination": "X", "days": True, "budget_usd": 1}, "days"),
        ({"destination": "X", "days": "3", "budget_usd": 1}, "days"),
        ({"destination": "X", "days": 3, "budget_usd": -5}, "budget_usd"),
        ({"destination": "X", "days": 3, "budget_usd": 5, "interests": "beach"}, "interests"),
    ]
    for data, name in cases:
        try:
            parse_trip_request(data)
        except ValueError as e:
            assert name in str(e), f"Lỗi cho {data} phải nhắc tới '{name}', nhận được: {e}"
            continue
        raise AssertionError(f"{data} phải bị từ chối")


def test_retry_recovers():
    """Model trả sai 2 lần rồi đúng -> thành công ở lần gọi thứ 3, và lỗi được gửi lại cho model"""
    model = MockChatModel(script=[
        "Sure! Here is your trip.",
        '{"destination": "Hà Nội", "days": 40, "budget_usd": 300}',
        '```json\n{"destination": "Hà Nội", "days": 4, "budget_usd": 300}\n```',
    ])
    r = extract_with_retry(model, "4 ngày Hà Nội", max_retries=2)
    assert r.days == 4 and model.calls == 3, (r, model.calls)
    feedback = [m.content for m in model.history[-1] if m.role == "user"]
    assert any("days" in c for c in feedback), "Lần retry phải gửi thông báo lỗi (nhắc 'days') cho model"


def test_retry_gives_up():
    """Hết lượt retry -> ValueError, tổng số lần gọi = max_retries + 1"""
    model = MockChatModel(script=["nope"] * 5)
    try:
        extract_with_retry(model, "...", max_retries=1)
    except ValueError:
        assert model.calls == 2, f"Phải gọi model đúng 2 lần, đã gọi {model.calls}"
        return
    raise AssertionError("Phải raise ValueError khi hết lượt retry")

# @@lc-agent-loop:starter
from dataclasses import dataclass, field

from labkit.llm import MockRule, get_chat_model, system, tool, tool_result, user

WEATHER = {"hanoi": "24°C, mưa nhẹ", "da nang": "29°C, nắng", "paris": "12°C, nhiều mây"}
ATTRACTIONS = {"hanoi": ["Hồ Hoàn Kiếm", "Văn Miếu"], "da nang": ["Bà Nà Hills", "Cầu Rồng"]}
RATES = {("USD", "VND"): 25000, ("EUR", "USD"): 1.1}


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    if city.lower() not in WEATHER:
        raise ValueError(f"Unknown city: {city}")
    return WEATHER[city.lower()]


@tool
def convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Convert an amount of money between two currencies."""
    rate = RATES.get((from_currency.upper(), to_currency.upper()))
    if rate is None:
        raise ValueError(f"No rate for {from_currency}->{to_currency}")
    return f"{amount * rate:,.0f} {to_currency.upper()}"


@tool
def search_attractions(city: str) -> str:
    """List top attractions in a city."""
    return ", ".join(ATTRACTIONS.get(city.lower(), [])) or "No attractions found"


TOOLS = [get_weather, convert_currency, search_attractions]

# Rules for the mock model. In real mode these are ignored and a real LLM decides.
RULES = [
    MockRule(r"weather.*(hanoi|hà nội)", calls=[("get_weather", {"city": "Hanoi"})], after_tool="Thời tiết Hà Nội: {result}"),
    MockRule(r"weather.*atlantis", calls=[("get_weather", {"city": "Atlantis"})], after_tool="Không lấy được thời tiết ({result})."),
    MockRule(r"convert|đổi", calls=[("convert_currency", {"amount": 100, "from_currency": "USD", "to_currency": "VND"})], after_tool="100 USD = {result}"),
    MockRule(r"trip.*da nang", calls=[("get_weather", {"city": "Da Nang"}), ("search_attractions", {"city": "Da Nang"})], after_tool="Đà Nẵng: {result}"),
    MockRule(r".*", reply="Mình có thể xem thời tiết, đổi tiền và gợi ý điểm tham quan."),
]


@dataclass
class AgentResult:
    answer: str
    steps: int  # number of model calls
    tool_log: list = field(default_factory=list)  # tuples (tool_name, args, ok, output)


def run_agent(model, tools, question: str, max_steps: int = 5) -> AgentResult:
    """Agent loop:
    1. messages = [system prompt, user question]
    2. call model.invoke(messages, tools=tools) and append the reply
    3. no tool_calls -> return the reply content as the answer
    4. otherwise run every tool call, append tool_result(output, call.id, call.name)
       - unknown tool  -> output "Error: unknown tool '<name>'"
       - tool raises   -> output "Error: <message>"  (never let the exception escape)
    5. stop after max_steps model calls with answer "Stopped: max steps reached"
    """
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    model = get_chat_model(rules=RULES)
    for q in ["What's the weather in Hanoi?", "Plan a trip to Da Nang", "What's the weather in Atlantis?"]:
        r = run_agent(model, TOOLS, q)
        print(f"Q: {q}\nA: {r.answer}\n   steps={r.steps} tools={[(n, ok) for n, _, ok, _ in r.tool_log]}\n")

# @@lc-agent-loop:solution
from dataclasses import dataclass, field

from labkit.llm import MockRule, get_chat_model, system, tool, tool_result, user

WEATHER = {"hanoi": "24°C, mưa nhẹ", "da nang": "29°C, nắng", "paris": "12°C, nhiều mây"}
ATTRACTIONS = {"hanoi": ["Hồ Hoàn Kiếm", "Văn Miếu"], "da nang": ["Bà Nà Hills", "Cầu Rồng"]}
RATES = {("USD", "VND"): 25000, ("EUR", "USD"): 1.1}


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    if city.lower() not in WEATHER:
        raise ValueError(f"Unknown city: {city}")
    return WEATHER[city.lower()]


@tool
def convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Convert an amount of money between two currencies."""
    rate = RATES.get((from_currency.upper(), to_currency.upper()))
    if rate is None:
        raise ValueError(f"No rate for {from_currency}->{to_currency}")
    return f"{amount * rate:,.0f} {to_currency.upper()}"


@tool
def search_attractions(city: str) -> str:
    """List top attractions in a city."""
    return ", ".join(ATTRACTIONS.get(city.lower(), [])) or "No attractions found"


TOOLS = [get_weather, convert_currency, search_attractions]

RULES = [
    MockRule(r"weather.*(hanoi|hà nội)", calls=[("get_weather", {"city": "Hanoi"})], after_tool="Thời tiết Hà Nội: {result}"),
    MockRule(r"weather.*atlantis", calls=[("get_weather", {"city": "Atlantis"})], after_tool="Không lấy được thời tiết ({result})."),
    MockRule(r"convert|đổi", calls=[("convert_currency", {"amount": 100, "from_currency": "USD", "to_currency": "VND"})], after_tool="100 USD = {result}"),
    MockRule(r"trip.*da nang", calls=[("get_weather", {"city": "Da Nang"}), ("search_attractions", {"city": "Da Nang"})], after_tool="Đà Nẵng: {result}"),
    MockRule(r".*", reply="Mình có thể xem thời tiết, đổi tiền và gợi ý điểm tham quan."),
]


@dataclass
class AgentResult:
    answer: str
    steps: int
    tool_log: list = field(default_factory=list)


def run_agent(model, tools, question: str, max_steps: int = 5) -> AgentResult:
    registry = {t.name: t for t in tools}
    messages = [system("You are a travel assistant. Use tools when they help."), user(question)]
    log = []
    for step in range(1, max_steps + 1):
        reply = model.invoke(messages, tools=tools)
        messages.append(reply)
        if not reply.tool_calls:
            return AgentResult(reply.content, step, log)
        for call in reply.tool_calls:
            fn = registry.get(call.name)
            if fn is None:
                out, ok = f"Error: unknown tool '{call.name}'", False
            else:
                try:
                    out, ok = str(fn.invoke(call.args)), True
                except Exception as e:  # report the error to the model instead of crashing
                    out, ok = f"Error: {e}", False
            log.append((call.name, call.args, ok, out))
            messages.append(tool_result(out, call.id, call.name))
    return AgentResult("Stopped: max steps reached", max_steps, log)


if __name__ == "__main__":
    model = get_chat_model(rules=RULES)
    for q in ["What's the weather in Hanoi?", "Plan a trip to Da Nang", "What's the weather in Atlantis?"]:
        r = run_agent(model, TOOLS, q)
        print(f"Q: {q}\nA: {r.answer}\n   steps={r.steps} tools={[(n, ok) for n, _, ok, _ in r.tool_log]}\n")

# @@lc-agent-loop:tests
from labkit.llm import MockChatModel, ToolCall, assistant


def test_direct_answer():
    """Câu hỏi không cần tool -> trả lời ngay sau 1 lần gọi model"""
    r = run_agent(MockChatModel(rules=RULES), TOOLS, "Xin chào")
    assert r.steps == 1 and r.tool_log == [], r
    assert "thời tiết" in r.answer


def test_single_tool_call():
    """Một tool call -> 2 lần gọi model, log ghi đúng tool và kết quả"""
    r = run_agent(MockChatModel(rules=RULES), TOOLS, "What's the weather in Hanoi?")
    assert r.steps == 2, r.steps
    assert r.tool_log == [("get_weather", {"city": "Hanoi"}, True, "24°C, mưa nhẹ")], r.tool_log
    assert "24°C" in r.answer


def test_tool_error_is_returned_to_model():
    """Tool raise exception -> không crash, lỗi được gửi lại model dưới dạng tool message"""
    r = run_agent(MockChatModel(rules=RULES), TOOLS, "What's the weather in Atlantis?")
    assert r.tool_log and r.tool_log[0][2] is False, r.tool_log
    assert "Unknown city" in r.tool_log[0][3]
    assert "Unknown city" in r.answer


def test_parallel_tool_calls():
    """Model yêu cầu 2 tool cùng lúc -> chạy cả hai trong cùng một bước"""
    r = run_agent(MockChatModel(rules=RULES), TOOLS, "Plan a trip to Da Nang")
    assert [n for n, *_ in r.tool_log] == ["get_weather", "search_attractions"], r.tool_log
    assert r.steps == 2


def test_unknown_tool():
    """Tool không tồn tại -> output 'Error: unknown tool ...'"""
    model = MockChatModel(script=[assistant("", [ToolCall("c1", "book_hotel", {"city": "Paris"})]), "Xin lỗi, không đặt được."])
    r = run_agent(model, TOOLS, "Book a hotel")
    assert r.tool_log[0][2] is False and "unknown tool" in r.tool_log[0][3], r.tool_log
    assert r.answer == "Xin lỗi, không đặt được."


def test_tool_messages_reference_call_id():
    """Tool message phải mang tool_call_id của lời gọi tương ứng"""
    model = MockChatModel(rules=RULES)
    run_agent(model, TOOLS, "What's the weather in Hanoi?")
    tool_msgs = [m for m in model.history[1] if m.role == "tool"]
    assert tool_msgs and tool_msgs[0].tool_call_id == "call_1", tool_msgs


def test_max_steps():
    """Model gọi tool mãi -> dừng sau max_steps lần gọi"""
    looping = [assistant("", [ToolCall(f"c{i}", "get_weather", {"city": "Paris"})]) for i in range(10)]
    r = run_agent(MockChatModel(script=looping), TOOLS, "loop", max_steps=3)
    assert r.answer.startswith("Stopped"), r.answer
    assert r.steps == 3 and len(r.tool_log) == 3, (r.steps, len(r.tool_log))
