# @@eval-harness:starter
import re
from dataclasses import dataclass, field

# 20 golden test cases for the travel agent. expected_tool None = the agent must NOT call a tool.
DATASET = [
    {"id": "w1", "question": "Thời tiết Hà Nội hôm nay thế nào?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w2", "question": "What's the weather like in Da Nang?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w3", "question": "Nhiệt độ ở Sapa bao nhiêu độ?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w4", "question": "Có nên mang áo mưa khi trời mưa ở Huế không?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w5", "question": "Is it sunny in Nha Trang tomorrow?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "c1", "question": "Đổi 100 USD sang VND được bao nhiêu?", "expected_tool": "convert_currency", "must_include": ["2,500,000"]},
    {"id": "c2", "question": "Tỷ giá USD hôm nay?", "expected_tool": "convert_currency", "must_include": ["VND"]},
    {"id": "c3", "question": "Convert 100 dollars to dong", "expected_tool": "convert_currency", "must_include": ["2,500,000"]},
    {"id": "c4", "question": "Đổi 50 EUR sang USD", "expected_tool": "convert_currency", "must_include": ["USD"]},
    {"id": "a1", "question": "Huế có điểm tham quan nào nổi tiếng?", "expected_tool": "search_attractions", "must_include": ["gợi ý"]},
    {"id": "a2", "question": "Top attractions in Hanoi?", "expected_tool": "search_attractions", "must_include": ["Văn Miếu"]},
    {"id": "a3", "question": "Đi đâu chơi ở Hà Nội cuối tuần?", "expected_tool": "search_attractions", "must_include": ["Hồ Gươm"]},
    {"id": "a4", "question": "Bao nhiêu tiền một vé vào Văn Miếu?", "expected_tool": "search_attractions", "must_include": ["Văn Miếu"]},
    {"id": "a5", "question": "Book a tour to see attractions in Hue", "expected_tool": "search_attractions", "must_include": ["gợi ý"]},
    {"id": "b1", "question": "Đặt phòng khách sạn ở Đà Lạt cho 2 người", "expected_tool": "book_hotel", "must_include": ["chờ xác nhận"]},
    {"id": "b2", "question": "Please book a room in Hoi An", "expected_tool": "book_hotel", "must_include": ["đặt phòng"]},
    {"id": "b3", "question": "I want to check the weather before I book", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "n1", "question": "Xin chào!", "expected_tool": None, "must_include": ["giúp"]},
    {"id": "n2", "question": "Cảm ơn bạn nhiều", "expected_tool": None, "must_include": ["giúp"]},
    {"id": "n3", "question": "Hủy đặt phòng giúp tôi", "expected_tool": None, "must_include": ["giúp"]},
]

ANSWERS = {
    "get_weather": "Thời tiết hôm nay: 28°C, nắng.",
    "convert_currency": "100 USD = 2,500,000 VND.",
    "search_attractions": "Gợi ý: Văn Miếu, Hồ Gươm.",
    "book_hotel": "Đã gửi yêu cầu đặt phòng, chờ xác nhận.",
    None: "Mình có thể giúp gì cho chuyến đi của bạn?",
}


def make_agent(routes, answers=ANSWERS):
    """A rule-based stand-in for the agent under test: first matching route picks the tool."""
    def agent(question: str) -> dict:
        tool = next((t for pattern, t in routes if re.search(pattern, question.lower())), None)
        return {"tool": tool, "answer": answers[tool]}
    return agent


agent_v1 = make_agent([
    (r"thời tiết|weather|nhiệt độ", "get_weather"),
    (r"đổi|tỷ giá|convert", "convert_currency"),
    (r"tham quan|attraction|đi đâu", "search_attractions"),
    (r"đặt phòng|book", "book_hotel"),
])

# v2 "fixes" several misses but reorders routes and reformats numbers. Does it regress?
agent_v2 = make_agent(
    [
        (r"hủy|cancel", None),
        (r"đặt phòng|book", "book_hotel"),
        (r"thời tiết|weather|nhiệt độ|mưa|sunny|nắng", "get_weather"),
        (r"đổi|tỷ giá|convert", "convert_currency"),
        (r"tham quan|attraction|đi đâu|vé", "search_attractions"),
    ],
    {**ANSWERS, "convert_currency": "100 USD = 2.500.000 VND."},
)


@dataclass
class CaseResult:
    id: str
    tool_ok: bool
    answer_ok: bool

    @property
    def success(self) -> bool:
        return self.tool_ok and self.answer_ok


@dataclass
class Report:
    results: list[CaseResult] = field(default_factory=list)
    tool_accuracy: float = 0.0
    answer_pass_rate: float = 0.0
    task_success_rate: float = 0.0
    failures: list[str] = field(default_factory=list)


def evaluate(agent, dataset=DATASET) -> Report:
    """Run the agent on every case.
    - tool_ok: returned tool == expected_tool (None must equal None)
    - answer_ok: every must_include string appears in the answer, case-insensitive
    - rates are fractions rounded to 3 decimals; failures = ids where success is False, in dataset order
    - raise ValueError on an empty dataset"""
    # TODO
    raise NotImplementedError


def regressions(baseline: Report, candidate: Report) -> list[str]:
    """Ids that succeeded in baseline but fail in candidate, in baseline order."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    r1, r2 = evaluate(agent_v1), evaluate(agent_v2)
    for name, r in [("v1", r1), ("v2", r2)]:
        print(f"{name}: tool={r.tool_accuracy} answer={r.answer_pass_rate} success={r.task_success_rate} failures={r.failures}")
    print("regressions v1 -> v2:", regressions(r1, r2))

# @@eval-harness:solution
import re
from dataclasses import dataclass, field

DATASET = [
    {"id": "w1", "question": "Thời tiết Hà Nội hôm nay thế nào?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w2", "question": "What's the weather like in Da Nang?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w3", "question": "Nhiệt độ ở Sapa bao nhiêu độ?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w4", "question": "Có nên mang áo mưa khi trời mưa ở Huế không?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "w5", "question": "Is it sunny in Nha Trang tomorrow?", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "c1", "question": "Đổi 100 USD sang VND được bao nhiêu?", "expected_tool": "convert_currency", "must_include": ["2,500,000"]},
    {"id": "c2", "question": "Tỷ giá USD hôm nay?", "expected_tool": "convert_currency", "must_include": ["VND"]},
    {"id": "c3", "question": "Convert 100 dollars to dong", "expected_tool": "convert_currency", "must_include": ["2,500,000"]},
    {"id": "c4", "question": "Đổi 50 EUR sang USD", "expected_tool": "convert_currency", "must_include": ["USD"]},
    {"id": "a1", "question": "Huế có điểm tham quan nào nổi tiếng?", "expected_tool": "search_attractions", "must_include": ["gợi ý"]},
    {"id": "a2", "question": "Top attractions in Hanoi?", "expected_tool": "search_attractions", "must_include": ["Văn Miếu"]},
    {"id": "a3", "question": "Đi đâu chơi ở Hà Nội cuối tuần?", "expected_tool": "search_attractions", "must_include": ["Hồ Gươm"]},
    {"id": "a4", "question": "Bao nhiêu tiền một vé vào Văn Miếu?", "expected_tool": "search_attractions", "must_include": ["Văn Miếu"]},
    {"id": "a5", "question": "Book a tour to see attractions in Hue", "expected_tool": "search_attractions", "must_include": ["gợi ý"]},
    {"id": "b1", "question": "Đặt phòng khách sạn ở Đà Lạt cho 2 người", "expected_tool": "book_hotel", "must_include": ["chờ xác nhận"]},
    {"id": "b2", "question": "Please book a room in Hoi An", "expected_tool": "book_hotel", "must_include": ["đặt phòng"]},
    {"id": "b3", "question": "I want to check the weather before I book", "expected_tool": "get_weather", "must_include": ["°C"]},
    {"id": "n1", "question": "Xin chào!", "expected_tool": None, "must_include": ["giúp"]},
    {"id": "n2", "question": "Cảm ơn bạn nhiều", "expected_tool": None, "must_include": ["giúp"]},
    {"id": "n3", "question": "Hủy đặt phòng giúp tôi", "expected_tool": None, "must_include": ["giúp"]},
]

ANSWERS = {
    "get_weather": "Thời tiết hôm nay: 28°C, nắng.",
    "convert_currency": "100 USD = 2,500,000 VND.",
    "search_attractions": "Gợi ý: Văn Miếu, Hồ Gươm.",
    "book_hotel": "Đã gửi yêu cầu đặt phòng, chờ xác nhận.",
    None: "Mình có thể giúp gì cho chuyến đi của bạn?",
}


def make_agent(routes, answers=ANSWERS):
    def agent(question: str) -> dict:
        tool = next((t for pattern, t in routes if re.search(pattern, question.lower())), None)
        return {"tool": tool, "answer": answers[tool]}
    return agent


agent_v1 = make_agent([
    (r"thời tiết|weather|nhiệt độ", "get_weather"),
    (r"đổi|tỷ giá|convert", "convert_currency"),
    (r"tham quan|attraction|đi đâu", "search_attractions"),
    (r"đặt phòng|book", "book_hotel"),
])

agent_v2 = make_agent(
    [
        (r"hủy|cancel", None),
        (r"đặt phòng|book", "book_hotel"),
        (r"thời tiết|weather|nhiệt độ|mưa|sunny|nắng", "get_weather"),
        (r"đổi|tỷ giá|convert", "convert_currency"),
        (r"tham quan|attraction|đi đâu|vé", "search_attractions"),
    ],
    {**ANSWERS, "convert_currency": "100 USD = 2.500.000 VND."},
)


@dataclass
class CaseResult:
    id: str
    tool_ok: bool
    answer_ok: bool

    @property
    def success(self) -> bool:
        return self.tool_ok and self.answer_ok


@dataclass
class Report:
    results: list[CaseResult] = field(default_factory=list)
    tool_accuracy: float = 0.0
    answer_pass_rate: float = 0.0
    task_success_rate: float = 0.0
    failures: list[str] = field(default_factory=list)


def evaluate(agent, dataset=DATASET) -> Report:
    if not dataset:
        raise ValueError("dataset is empty")
    results = []
    for case in dataset:
        out = agent(case["question"])
        answer = out["answer"].lower()
        results.append(CaseResult(
            case["id"],
            out["tool"] == case["expected_tool"],
            all(s.lower() in answer for s in case["must_include"]),
        ))
    n = len(results)
    return Report(
        results,
        round(sum(r.tool_ok for r in results) / n, 3),
        round(sum(r.answer_ok for r in results) / n, 3),
        round(sum(r.success for r in results) / n, 3),
        [r.id for r in results if not r.success],
    )


def regressions(baseline: Report, candidate: Report) -> list[str]:
    after = {r.id: r.success for r in candidate.results}
    return [r.id for r in baseline.results if r.success and not after.get(r.id, False)]


if __name__ == "__main__":
    r1, r2 = evaluate(agent_v1), evaluate(agent_v2)
    for name, r in [("v1", r1), ("v2", r2)]:
        print(f"{name}: tool={r.tool_accuracy} answer={r.answer_pass_rate} success={r.task_success_rate} failures={r.failures}")
    print("regressions v1 -> v2:", regressions(r1, r2))

# @@eval-harness:tests
def test_dataset_has_20_cases():
    """Bộ golden test có đủ 20 case, id không trùng"""
    assert len(DATASET) == 20 and len({c["id"] for c in DATASET}) == 20


def test_metrics_v1():
    """Metric của agent v1 tính đúng"""
    r = evaluate(agent_v1)
    assert (r.tool_accuracy, r.answer_pass_rate, r.task_success_rate) == (EXPECTED_V1["tool"], EXPECTED_V1["answer"], EXPECTED_V1["success"]), r
    assert r.failures == EXPECTED_V1["failures"], r.failures


def test_answer_check_is_case_insensitive():
    """must_include so khớp không phân biệt hoa thường ('gợi ý' khớp 'Gợi ý')"""
    r = evaluate(agent_v1, [DATASET[9]])
    assert r.results[0].answer_ok is True


def test_regressions_detected():
    """So sánh v1 -> v2 phát hiện đúng các case bị hồi quy"""
    assert regressions(evaluate(agent_v1), evaluate(agent_v2)) == EXPECTED_REGRESSIONS


def test_empty_dataset_rejected():
    try:
        evaluate(agent_v1, [])
    except ValueError:
        return
    raise AssertionError("dataset rỗng phải raise ValueError")


EXPECTED_V1 = {"tool": 0.8, "answer": 0.8, "success": 0.8, "failures": ["w4", "w5", "a4", "n3"]}
EXPECTED_REGRESSIONS = ["c1", "c3", "a5", "b3"]


def test_v2_better_tool_accuracy_but_regresses():
    """v2 có tool accuracy cao hơn nhưng task success không tăng: metric tổng hợp che giấu hồi quy"""
    r1, r2 = evaluate(agent_v1), evaluate(agent_v2)
    assert r2.tool_accuracy > r1.tool_accuracy and r2.task_success_rate == r1.task_success_rate, (r1, r2)
