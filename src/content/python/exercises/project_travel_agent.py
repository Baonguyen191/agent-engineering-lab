# @@tp-structured-plan:starter
import json
import re
from dataclasses import dataclass

from labkit.llm import assistant, get_chat_model, system, user

PLAN_PROMPT = """You are a travel planner. Reply with JSON only:
{"destination": str, "total_budget_usd": number, "days": [{"day": 1, "city": str, "activities": [str, ...]}, ...]}
Use exactly the requested number of days and 1-5 activities per day."""


@dataclass
class DayPlan:
    day: int
    city: str
    activities: list[str]


@dataclass
class TripPlan:
    destination: str
    total_budget_usd: float
    days: list[DayPlan]


def extract_json(text: str) -> dict:
    """Given (stage 1 helper): JSON object from raw text or a ```json block."""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text[text.find("{") : text.rfind("}") + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {e.msg}") from e
    if not isinstance(data, dict):
        raise ValueError("JSON must be an object")
    return data


def parse_plan(data: dict, expected_days: int) -> TripPlan:
    """Validate and convert. Raise ValueError (message naming the problem) when:
    - destination is not a non-empty string
    - total_budget_usd is not a number > 0 (bool is not a number here)
    - days is not a list of exactly `expected_days` items
    - day numbers are not 1, 2, ..., expected_days in order
    - a day has no city, or activities is not a list of 1-5 non-empty strings"""
    # TODO
    raise NotImplementedError


def plan_trip(model, request: str, expected_days: int, max_retries: int = 1) -> TripPlan:
    """Ask the model (system PLAN_PROMPT + user request), parse; on ValueError send the error back and retry."""
    # TODO
    raise NotImplementedError


SAMPLE = {"destination": "Huế", "total_budget_usd": 250, "days": [
    {"day": 1, "city": "Huế", "activities": ["Đại Nội", "Chùa Thiên Mụ"]},
    {"day": 2, "city": "Huế", "activities": ["Lăng Tự Đức", "Ẩm thực đường phố"]},
]}

if __name__ == "__main__":
    model = get_chat_model(script=[json.dumps(SAMPLE, ensure_ascii=False)])
    print(plan_trip(model, "2 ngày ở Huế, 250 USD", expected_days=2))

# @@tp-structured-plan:solution
import json
import re
from dataclasses import dataclass

from labkit.llm import assistant, get_chat_model, system, user

PLAN_PROMPT = """You are a travel planner. Reply with JSON only:
{"destination": str, "total_budget_usd": number, "days": [{"day": 1, "city": str, "activities": [str, ...]}, ...]}
Use exactly the requested number of days and 1-5 activities per day."""


@dataclass
class DayPlan:
    day: int
    city: str
    activities: list[str]


@dataclass
class TripPlan:
    destination: str
    total_budget_usd: float
    days: list[DayPlan]


def extract_json(text: str) -> dict:
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text[text.find("{") : text.rfind("}") + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {e.msg}") from e
    if not isinstance(data, dict):
        raise ValueError("JSON must be an object")
    return data


def parse_plan(data: dict, expected_days: int) -> TripPlan:
    dest = data.get("destination")
    if not isinstance(dest, str) or not dest.strip():
        raise ValueError("destination must be a non-empty string")
    budget = data.get("total_budget_usd")
    if isinstance(budget, bool) or not isinstance(budget, (int, float)) or budget <= 0:
        raise ValueError("total_budget_usd must be a number > 0")
    days = data.get("days")
    if not isinstance(days, list) or len(days) != expected_days:
        raise ValueError(f"days must be a list of exactly {expected_days} items")
    plans = []
    for i, d in enumerate(days, start=1):
        if not isinstance(d, dict) or d.get("day") != i:
            raise ValueError(f"day numbers must be 1..{expected_days} in order (problem at position {i})")
        city = d.get("city")
        if not isinstance(city, str) or not city.strip():
            raise ValueError(f"day {i}: city is required")
        acts = d.get("activities")
        if not isinstance(acts, list) or not 1 <= len(acts) <= 5 or not all(isinstance(a, str) and a.strip() for a in acts):
            raise ValueError(f"day {i}: activities must be 1-5 non-empty strings")
        plans.append(DayPlan(i, city.strip(), acts))
    return TripPlan(dest.strip(), float(budget), plans)


def plan_trip(model, request: str, expected_days: int, max_retries: int = 1) -> TripPlan:
    messages = [system(PLAN_PROMPT), user(request)]
    error = None
    for _ in range(max_retries + 1):
        reply = model.invoke(messages)
        try:
            return parse_plan(extract_json(reply.content), expected_days)
        except ValueError as e:
            error = e
            messages += [assistant(reply.content), user(f"Invalid plan: {e}. Return corrected JSON only.")]
    raise ValueError(f"could not get a valid plan: {error}")


SAMPLE = {"destination": "Huế", "total_budget_usd": 250, "days": [
    {"day": 1, "city": "Huế", "activities": ["Đại Nội", "Chùa Thiên Mụ"]},
    {"day": 2, "city": "Huế", "activities": ["Lăng Tự Đức", "Ẩm thực đường phố"]},
]}

if __name__ == "__main__":
    model = get_chat_model(script=[json.dumps(SAMPLE, ensure_ascii=False)])
    print(plan_trip(model, "2 ngày ở Huế, 250 USD", expected_days=2))

# @@tp-structured-plan:tests
import copy

from labkit.llm import MockChatModel


def test_parse_valid_plan():
    plan = parse_plan(SAMPLE, 2)
    assert plan.destination == "Huế" and plan.total_budget_usd == 250.0
    assert [d.day for d in plan.days] == [1, 2] and plan.days[0].activities[0] == "Đại Nội"


def test_rejects_wrong_day_count_and_order():
    """Sai số ngày hoặc thứ tự ngày -> ValueError"""
    bad_order = copy.deepcopy(SAMPLE)
    bad_order["days"][1]["day"] = 3
    for data, n in [(SAMPLE, 3), (bad_order, 2)]:
        try:
            parse_plan(data, n)
        except ValueError:
            continue
        raise AssertionError("phải raise ValueError")


def test_rejects_bad_activities():
    """Ngày không có hoạt động, quá 5 hoạt động, hoặc thiếu city -> ValueError"""
    for patch in [{"activities": []}, {"activities": ["a"] * 6}, {"activities": ["ok", " "]}, {"city": ""}]:
        data = copy.deepcopy(SAMPLE)
        data["days"][0].update(patch)
        try:
            parse_plan(data, 2)
        except ValueError:
            continue
        raise AssertionError(f"{patch} phải bị từ chối")


def test_plan_trip_retries_with_feedback():
    """Lần 1 sai số ngày -> gửi lỗi cho model -> lần 2 đúng"""
    one_day = {**SAMPLE, "days": SAMPLE["days"][:1]}
    model = MockChatModel(script=[json.dumps(one_day), json.dumps(SAMPLE)])
    plan = plan_trip(model, "2 ngày Huế", expected_days=2)
    assert len(plan.days) == 2 and model.calls == 2
    assert "exactly 2" in model.history[-1][-1].content, model.history[-1][-1].content

# @@tp-graph-workflow:starter
from labkit.graph import END, START, StateGraph

WEATHER = {"Đà Lạt": "18°C, mát", "Huế": "30°C, nắng"}
SIGHTS = {"Đà Lạt": ["Hồ Xuân Hương", "Thung lũng Tình Yêu", "Chợ Đà Lạt"], "Huế": ["Đại Nội", "Chùa Thiên Mụ"]}


def extend(left, right):
    return (left or []) + list(right)


def parse_request(state):
    return {"city": state["request"]["city"], "days": state["request"]["days"], "attempt": 0}


def research_weather(state):
    return {"research": [f"weather: {WEATHER.get(state['city'], 'unknown')}"]}


def research_sights(state):
    return {"research": [f"sights: {', '.join(SIGHTS.get(state['city'], []))}"]}


def draft_itinerary(state):
    """Simulates an LLM draft. With request["flaky"] the first draft leaves the last day empty."""
    attempt = state["attempt"] + 1
    sights = SIGHTS.get(state["city"], [])
    days = [[sights[i % len(sights)]] if sights else [] for i in range(state["days"])]
    if state["request"].get("flaky") and attempt == 1:
        days[-1] = []
    return {"itinerary": days, "attempt": attempt}


def review(state):
    """Quality gate: approved only if every day has at least one activity."""
    # TODO: return {"approved": bool}
    raise NotImplementedError


def route_after_review(state) -> str:
    """END when approved or after 3 attempts; otherwise back to draft_itinerary."""
    # TODO
    raise NotImplementedError


def build_graph():
    """parse_request -> research_weather & research_sights (parallel) -> draft_itinerary -> review -> (loop | END)
    'research' is written by two parallel nodes: give it the `extend` reducer."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    g = build_graph()
    for step in g.stream({"request": {"city": "Đà Lạt", "days": 2, "flaky": True}}):
        print(step)

# @@tp-graph-workflow:solution
from labkit.graph import END, START, StateGraph

WEATHER = {"Đà Lạt": "18°C, mát", "Huế": "30°C, nắng"}
SIGHTS = {"Đà Lạt": ["Hồ Xuân Hương", "Thung lũng Tình Yêu", "Chợ Đà Lạt"], "Huế": ["Đại Nội", "Chùa Thiên Mụ"]}


def extend(left, right):
    return (left or []) + list(right)


def parse_request(state):
    return {"city": state["request"]["city"], "days": state["request"]["days"], "attempt": 0}


def research_weather(state):
    return {"research": [f"weather: {WEATHER.get(state['city'], 'unknown')}"]}


def research_sights(state):
    return {"research": [f"sights: {', '.join(SIGHTS.get(state['city'], []))}"]}


def draft_itinerary(state):
    attempt = state["attempt"] + 1
    sights = SIGHTS.get(state["city"], [])
    days = [[sights[i % len(sights)]] if sights else [] for i in range(state["days"])]
    if state["request"].get("flaky") and attempt == 1:
        days[-1] = []
    return {"itinerary": days, "attempt": attempt}


def review(state):
    return {"approved": all(len(day) > 0 for day in state["itinerary"])}


def route_after_review(state) -> str:
    return END if state["approved"] or state["attempt"] >= 3 else "draft_itinerary"


def build_graph():
    g = StateGraph(reducers={"research": extend})
    g.add_node("parse_request", parse_request)
    g.add_node("research_weather", research_weather)
    g.add_node("research_sights", research_sights)
    g.add_node("draft_itinerary", draft_itinerary)
    g.add_node("review", review)
    g.add_edge(START, "parse_request")
    g.add_edge("parse_request", "research_weather")
    g.add_edge("parse_request", "research_sights")
    g.add_edge("research_weather", "draft_itinerary")
    g.add_edge("research_sights", "draft_itinerary")
    g.add_edge("draft_itinerary", "review")
    g.add_conditional_edges("review", route_after_review)
    return g.compile()


if __name__ == "__main__":
    g = build_graph()
    for step in g.stream({"request": {"city": "Đà Lạt", "days": 2, "flaky": True}}):
        print(step)

# @@tp-graph-workflow:tests
def test_happy_path():
    """Một lượt draft là đạt; research có cả weather và sights"""
    out = build_graph().invoke({"request": {"city": "Huế", "days": 2}})
    assert out["approved"] is True and out["attempt"] == 1, out
    assert sorted(r.split(":")[0] for r in out["research"]) == ["sights", "weather"], out["research"]


def test_review_loop_fixes_flaky_draft():
    """Draft đầu thiếu hoạt động -> review từ chối -> draft lại -> đạt ở lần 2"""
    out = build_graph().invoke({"request": {"city": "Đà Lạt", "days": 3, "flaky": True}})
    assert out["approved"] is True and out["attempt"] == 2, out
    assert all(out["itinerary"]), out["itinerary"]


def test_loop_is_bounded():
    """Thành phố không có dữ liệu -> không bao giờ đạt, nhưng dừng sau 3 lần"""
    out = build_graph().invoke({"request": {"city": "Atlantis", "days": 1}})
    assert out["approved"] is False and out["attempt"] == 3, out


def test_draft_runs_once_per_attempt():
    """Hai nhánh song song cùng trỏ tới draft_itinerary nhưng draft chỉ chạy 1 lần mỗi lượt"""
    names = [list(s)[0] for s in build_graph().stream({"request": {"city": "Huế", "days": 1}})]
    assert names.count("draft_itinerary") == 1, names

# @@tp-memory:starter
import re

from labkit.graph import END, START, MemorySaver, StateGraph, add_messages


def merge_prefs(left, right):
    """Reducer: shallow-merge dicts; later values win; None values in `right` delete the key."""
    # TODO
    raise NotImplementedError


def extract_preferences(state):
    """Read the latest user message and return {"preferences": {...}} with any of:
    budget_usd (int)  from "budget 500" / "ngân sách 500"
    style             "beach" if the message mentions biển/beach, "mountain" if núi/mountain
    diet              "vegetarian" if it mentions chay/vegetarian
    Return {} when nothing is found."""
    text = state["messages"][-1]["content"].lower()
    prefs = {}
    m = re.search(r"(?:budget|ngân sách)\D*(\d+)", text)
    if m:
        prefs["budget_usd"] = int(m.group(1))
    if re.search(r"biển|beach", text):
        prefs["style"] = "beach"
    elif re.search(r"núi|mountain", text):
        prefs["style"] = "mountain"
    if re.search(r"chay|vegetarian", text):
        prefs["diet"] = "vegetarian"
    return {"preferences": prefs} if prefs else {}


def respond(state):
    p = state.get("preferences") or {}
    known = ", ".join(f"{k}={v}" for k, v in sorted(p.items())) or "chưa có"
    return {"messages": [{"role": "assistant", "content": f"Sở thích đã lưu: {known}"}]}


def build_graph(checkpointer):
    """START -> extract_preferences -> respond -> END, reducers: messages=add_messages, preferences=merge_prefs."""
    # TODO
    raise NotImplementedError


def chat(graph, thread_id: str, text: str) -> str:
    out = graph.invoke({"messages": [{"role": "user", "content": text}]}, {"configurable": {"thread_id": thread_id}})
    return out["messages"][-1]["content"]


if __name__ == "__main__":
    g = build_graph(MemorySaver())
    print(chat(g, "an", "Ngân sách 600 USD nhé"))
    print(chat(g, "an", "Mình thích biển và ăn chay"))
    print(chat(g, "binh", "Xin chào"))

# @@tp-memory:solution
import re

from labkit.graph import END, START, MemorySaver, StateGraph, add_messages


def merge_prefs(left, right):
    merged = dict(left or {})
    for k, v in (right or {}).items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[k] = v
    return merged


def extract_preferences(state):
    text = state["messages"][-1]["content"].lower()
    prefs = {}
    m = re.search(r"(?:budget|ngân sách)\D*(\d+)", text)
    if m:
        prefs["budget_usd"] = int(m.group(1))
    if re.search(r"biển|beach", text):
        prefs["style"] = "beach"
    elif re.search(r"núi|mountain", text):
        prefs["style"] = "mountain"
    if re.search(r"chay|vegetarian", text):
        prefs["diet"] = "vegetarian"
    return {"preferences": prefs} if prefs else {}


def respond(state):
    p = state.get("preferences") or {}
    known = ", ".join(f"{k}={v}" for k, v in sorted(p.items())) or "chưa có"
    return {"messages": [{"role": "assistant", "content": f"Sở thích đã lưu: {known}"}]}


def build_graph(checkpointer):
    g = StateGraph(reducers={"messages": add_messages, "preferences": merge_prefs})
    g.add_node("extract_preferences", extract_preferences)
    g.add_node("respond", respond)
    g.add_edge(START, "extract_preferences")
    g.add_edge("extract_preferences", "respond")
    g.add_edge("respond", END)
    return g.compile(checkpointer=checkpointer)


def chat(graph, thread_id: str, text: str) -> str:
    out = graph.invoke({"messages": [{"role": "user", "content": text}]}, {"configurable": {"thread_id": thread_id}})
    return out["messages"][-1]["content"]


if __name__ == "__main__":
    g = build_graph(MemorySaver())
    print(chat(g, "an", "Ngân sách 600 USD nhé"))
    print(chat(g, "an", "Mình thích biển và ăn chay"))
    print(chat(g, "binh", "Xin chào"))

# @@tp-memory:tests
def test_merge_prefs():
    """Gộp nông, giá trị sau thắng, None xóa key, không sửa input"""
    left = {"budget_usd": 500, "style": "beach"}
    assert merge_prefs(left, {"style": "mountain", "diet": None}) == {"budget_usd": 500, "style": "mountain"}
    assert merge_prefs(left, {"budget_usd": None}) == {"style": "beach"}
    assert left == {"budget_usd": 500, "style": "beach"}
    assert merge_prefs(None, {"a": 1}) == {"a": 1}


def test_memory_across_turns():
    """Cùng thread_id: lượt 2 vẫn nhớ ngân sách từ lượt 1"""
    g = build_graph(MemorySaver())
    chat(g, "an", "Ngân sách 600 USD nhé")
    reply = chat(g, "an", "Mình thích biển và ăn chay")
    assert reply == "Sở thích đã lưu: budget_usd=600, diet=vegetarian, style=beach", reply


def test_threads_are_isolated():
    """Thread khác không thấy sở thích của thread kia"""
    g = build_graph(MemorySaver())
    chat(g, "an", "budget 900")
    assert chat(g, "binh", "Xin chào") == "Sở thích đã lưu: chưa có"


def test_history_grows():
    """Checkpoint lưu toàn bộ hội thoại: 2 lượt -> 4 messages"""
    g = build_graph(MemorySaver())
    chat(g, "c", "budget 100")
    chat(g, "c", "thích núi")
    state = g.get_state({"configurable": {"thread_id": "c"}})
    assert len(state.values["messages"]) == 4, state.values["messages"]
    assert state.values["preferences"] == {"budget_usd": 100, "style": "mountain"}

# @@tp-tracing:starter
import json
from contextlib import contextmanager

SECRET_KEYS = {"api_key", "password", "authorization", "token"}


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self):
        return self.now

    def advance(self, s):
        self.now += s


def redact_attrs(attrs: dict) -> dict:
    """Copy of attrs where keys in SECRET_KEYS (case-insensitive) have the value "***"."""
    # TODO
    raise NotImplementedError


class Tracer:
    """Records spans: {"id", "parent_id", "name", "start", "end", "duration", "status", "error", "attrs"}.
    Ids are 1, 2, 3... in creation order. parent_id is the id of the enclosing open span or None."""

    def __init__(self, clock=None):
        self.clock = clock or FakeClock()
        self.spans: list[dict] = []
        self._stack: list[int] = []

    @contextmanager
    def span(self, name: str, **attrs):
        """Open a span; on exit fill end/duration and status "ok", or status "error" and
        error=f"{type(e).__name__}: {e}" if the block raised - then re-raise. attrs are redacted."""
        # TODO
        raise NotImplementedError
        yield  # noqa

    def traced(self, name: str | None = None):
        """Decorator that wraps a function call in self.span(name or fn.__name__)."""
        # TODO
        raise NotImplementedError

    def export_jsonl(self) -> str:
        """One JSON object per line, spans in id order (ensure_ascii=False)."""
        # TODO
        raise NotImplementedError


if __name__ == "__main__":
    clock = FakeClock()
    tracer = Tracer(clock)

    @tracer.traced()
    def call_llm(prompt):
        clock.advance(0.8)
        return "ok"

    with tracer.span("agent_run", user="an", api_key="sk-123"):
        with tracer.span("tool:get_weather", city="Huế"):
            clock.advance(0.2)
        call_llm("hi")
    print(tracer.export_jsonl())

# @@tp-tracing:solution
import json
from contextlib import contextmanager

SECRET_KEYS = {"api_key", "password", "authorization", "token"}


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self):
        return self.now

    def advance(self, s):
        self.now += s


def redact_attrs(attrs: dict) -> dict:
    return {k: ("***" if k.lower() in SECRET_KEYS else v) for k, v in attrs.items()}


class Tracer:
    def __init__(self, clock=None):
        self.clock = clock or FakeClock()
        self.spans: list[dict] = []
        self._stack: list[int] = []

    @contextmanager
    def span(self, name: str, **attrs):
        span = {
            "id": len(self.spans) + 1,
            "parent_id": self._stack[-1] if self._stack else None,
            "name": name,
            "start": self.clock.time(),
            "end": None,
            "duration": None,
            "status": "ok",
            "error": None,
            "attrs": redact_attrs(attrs),
        }
        self.spans.append(span)
        self._stack.append(span["id"])
        try:
            yield span
        except Exception as e:
            span["status"], span["error"] = "error", f"{type(e).__name__}: {e}"
            raise
        finally:
            self._stack.pop()
            span["end"] = self.clock.time()
            span["duration"] = round(span["end"] - span["start"], 6)

    def traced(self, name: str | None = None):
        def decorator(fn):
            def wrapper(*args, **kwargs):
                with self.span(name or fn.__name__):
                    return fn(*args, **kwargs)
            return wrapper
        return decorator

    def export_jsonl(self) -> str:
        return "\n".join(json.dumps(s, ensure_ascii=False) for s in self.spans)


if __name__ == "__main__":
    clock = FakeClock()
    tracer = Tracer(clock)

    @tracer.traced()
    def call_llm(prompt):
        clock.advance(0.8)
        return "ok"

    with tracer.span("agent_run", user="an", api_key="sk-123"):
        with tracer.span("tool:get_weather", city="Huế"):
            clock.advance(0.2)
        call_llm("hi")
    print(tracer.export_jsonl())

# @@tp-tracing:tests
def test_redact():
    assert redact_attrs({"API_KEY": "sk", "city": "Huế", "token": "t"}) == {"API_KEY": "***", "city": "Huế", "token": "***"}


def test_nested_spans_and_durations():
    """Span lồng nhau có parent_id đúng, duration lấy từ clock"""
    clock = FakeClock()
    t = Tracer(clock)
    with t.span("run"):
        with t.span("llm"):
            clock.advance(1.5)
        with t.span("tool"):
            clock.advance(0.5)
    run, llm, tool = t.spans
    assert (run["parent_id"], llm["parent_id"], tool["parent_id"]) == (None, 1, 1), t.spans
    assert (run["duration"], llm["duration"], tool["duration"]) == (2.0, 1.5, 0.5), t.spans


def test_error_recorded_and_reraised():
    """Lỗi trong span được ghi lại và vẫn ném ra ngoài"""
    t = Tracer()
    try:
        with t.span("tool"):
            raise TimeoutError("weather API")
    except TimeoutError:
        pass
    else:
        raise AssertionError("exception phải được ném lại")
    assert t.spans[0]["status"] == "error" and t.spans[0]["error"] == "TimeoutError: weather API", t.spans[0]
    assert t.spans[0]["end"] is not None


def test_decorator_and_export():
    """@traced tạo span theo tên hàm; export_jsonl ra mỗi span một dòng JSON"""
    t = Tracer()

    @t.traced()
    def plan():
        return 42

    @t.traced("custom")
    def other():
        return 1

    assert plan() == 42 and other() == 1
    lines = t.export_jsonl().splitlines()
    assert [json.loads(line)["name"] for line in lines] == ["plan", "custom"], lines


def test_secrets_never_exported():
    t = Tracer()
    with t.span("llm", api_key="sk-secret", model="gpt"):
        pass
    assert "sk-secret" not in t.export_jsonl()
