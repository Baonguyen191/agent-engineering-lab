# @@lg-reducers:starter
from labkit.graph import END, START, StateGraph


def merge_messages(left, right):
    """Reducer for a list of message dicts that each have an "id".
    - `right` may be one dict or a list of dicts
    - a message whose id already exists replaces the old one, keeping its position
    - a message with a new id is appended
    - {"id": X, "remove": True} deletes message X
    - never mutate `left`; return a new list
    """
    # TODO
    raise NotImplementedError


def extend(left, right):
    return (left or []) + list(right)


def flights(state):
    return {"options": ["flight: VN123"]}


def hotels(state):
    return {"options": ["hotel: Sunrise"]}


def summarize(state):
    opts = sorted(state["options"])
    return {"summary": f"{len(opts)} options: " + " | ".join(opts)}


def build_parallel_search():
    """START -> flights and hotels in parallel -> summarize -> END.
    Both parallel nodes write "options": register a reducer so neither write is lost."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    print(merge_messages([{"id": 1, "text": "hi"}], {"id": 2, "text": "hello"}))
    print(build_parallel_search().invoke({"options": []})["summary"])

# @@lg-reducers:solution
from labkit.graph import END, START, StateGraph


def merge_messages(left, right):
    result = list(left or [])
    for msg in right if isinstance(right, list) else [right]:
        idx = next((i for i, m in enumerate(result) if m["id"] == msg["id"]), None)
        if msg.get("remove"):
            if idx is not None:
                result.pop(idx)
        elif idx is None:
            result.append(msg)
        else:
            result[idx] = msg
    return result


def extend(left, right):
    return (left or []) + list(right)


def flights(state):
    return {"options": ["flight: VN123"]}


def hotels(state):
    return {"options": ["hotel: Sunrise"]}


def summarize(state):
    opts = sorted(state["options"])
    return {"summary": f"{len(opts)} options: " + " | ".join(opts)}


def build_parallel_search():
    g = StateGraph(reducers={"options": extend})
    g.add_node("flights", flights)
    g.add_node("hotels", hotels)
    g.add_node("summarize", summarize)
    g.add_edge(START, "flights")
    g.add_edge(START, "hotels")
    g.add_edge("flights", "summarize")
    g.add_edge("hotels", "summarize")
    g.add_edge("summarize", END)
    return g.compile()


if __name__ == "__main__":
    print(merge_messages([{"id": 1, "text": "hi"}], {"id": 2, "text": "hello"}))
    print(build_parallel_search().invoke({"options": []})["summary"])

# @@lg-reducers:tests
from labkit.graph import InvalidUpdateError


def test_append_new():
    """id mới được nối vào cuối; chấp nhận cả dict lẫn list"""
    a = [{"id": 1, "text": "a"}]
    assert merge_messages(a, {"id": 2, "text": "b"}) == [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]
    assert len(merge_messages(None, [{"id": 1}, {"id": 2}])) == 2


def test_replace_same_id_keeps_position():
    """id trùng -> thay thế tại đúng vị trí cũ"""
    a = [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]
    out = merge_messages(a, {"id": 1, "text": "A"})
    assert out == [{"id": 1, "text": "A"}, {"id": 2, "text": "b"}], out


def test_remove():
    """{'id': X, 'remove': True} xóa message X"""
    a = [{"id": 1}, {"id": 2}, {"id": 3}]
    assert [m["id"] for m in merge_messages(a, {"id": 2, "remove": True})] == [1, 3]


def test_does_not_mutate_left():
    """Reducer phải là hàm thuần: không sửa list đầu vào"""
    a = [{"id": 1, "text": "a"}]
    merge_messages(a, [{"id": 1, "text": "x"}, {"id": 2}])
    assert a == [{"id": 1, "text": "a"}], a


def test_parallel_graph_keeps_both_writes():
    """Hai node song song cùng ghi 'options' -> cả hai giá trị được giữ"""
    out = build_parallel_search().invoke({"options": []})
    assert out["summary"] == "2 options: flight: VN123 | hotel: Sunrise", out


def test_without_reducer_conflicts():
    """(Minh họa) Không có reducer -> hai node song song ghi cùng key là lỗi"""
    g = StateGraph()
    g.add_node("flights", flights)
    g.add_node("hotels", hotels)
    g.add_edge(START, "flights")
    g.add_edge(START, "hotels")
    try:
        g.compile().invoke({})
    except InvalidUpdateError:
        return
    raise AssertionError("expected InvalidUpdateError")

# @@lg-approval-workflow:starter
from labkit.graph import END, START, Command, MemorySaver, StateGraph, interrupt

APPROVAL_LIMIT = 500  # USD; bookings above this need a human


def classify(state):
    kind = state["request"].get("type")
    return {"route": "question" if kind == "question" else "booking"}


def answer_question(state):
    return {"status": "answered", "reply": f"Trả lời: {state['request'].get('text', '')}"}


def draft_booking(state):
    req = state["request"]
    return {"draft": {"hotel": req.get("hotel", "?"), "amount": req.get("amount", 0)}}


def validate(state):
    """Return {"errors": [...]}: "amount must be > 0" if amount <= 0, "hotel is required" if hotel == "?"."""
    # TODO
    raise NotImplementedError


def human_approval(state):
    """Pause with interrupt({"question": "...", "amount": <amount>}).
    The value passed to Command(resume=...) comes back from interrupt(); store it as {"approved": bool}."""
    # TODO
    raise NotImplementedError


def finalize(state):
    """status = "invalid" if errors, "rejected" if approved is False, otherwise "confirmed"."""
    # TODO
    raise NotImplementedError


def route_after_classify(state) -> str:
    # TODO: "answer_question" or "draft_booking"
    raise NotImplementedError


def route_after_validate(state) -> str:
    # TODO: "finalize" when there are errors or amount <= APPROVAL_LIMIT, else "human_approval"
    raise NotImplementedError


def build_graph(checkpointer=None):
    """classify -> (answer_question -> END) | (draft_booking -> validate -> [human_approval] -> finalize -> END)"""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    graph = build_graph(MemorySaver())
    cfg = {"configurable": {"thread_id": "demo"}}
    out = graph.invoke({"request": {"type": "booking", "hotel": "Sofitel", "amount": 900}}, cfg)
    print("Paused:", out.get("__interrupt__"))
    print("Next node:", graph.get_state(cfg).next)
    print("After approval:", graph.invoke(Command(resume=True), cfg)["status"])

# @@lg-approval-workflow:solution
from labkit.graph import END, START, Command, MemorySaver, StateGraph, interrupt

APPROVAL_LIMIT = 500


def classify(state):
    kind = state["request"].get("type")
    return {"route": "question" if kind == "question" else "booking"}


def answer_question(state):
    return {"status": "answered", "reply": f"Trả lời: {state['request'].get('text', '')}"}


def draft_booking(state):
    req = state["request"]
    return {"draft": {"hotel": req.get("hotel", "?"), "amount": req.get("amount", 0)}}


def validate(state):
    draft, errors = state["draft"], []
    if not isinstance(draft["amount"], (int, float)) or draft["amount"] <= 0:
        errors.append("amount must be > 0")
    if draft["hotel"] == "?":
        errors.append("hotel is required")
    return {"errors": errors}


def human_approval(state):
    decision = interrupt({"question": "Duyệt đặt phòng này?", "amount": state["draft"]["amount"]})
    return {"approved": bool(decision)}


def finalize(state):
    if state.get("errors"):
        return {"status": "invalid"}
    if state.get("approved") is False:
        return {"status": "rejected"}
    return {"status": "confirmed"}


def route_after_classify(state) -> str:
    return "answer_question" if state["route"] == "question" else "draft_booking"


def route_after_validate(state) -> str:
    if state["errors"] or state["draft"]["amount"] <= APPROVAL_LIMIT:
        return "finalize"
    return "human_approval"


def build_graph(checkpointer=None):
    g = StateGraph()
    for name, fn in [
        ("classify", classify), ("answer_question", answer_question), ("draft_booking", draft_booking),
        ("validate", validate), ("human_approval", human_approval), ("finalize", finalize),
    ]:
        g.add_node(name, fn)
    g.add_edge(START, "classify")
    g.add_conditional_edges("classify", route_after_classify)
    g.add_edge("answer_question", END)
    g.add_edge("draft_booking", "validate")
    g.add_conditional_edges("validate", route_after_validate)
    g.add_edge("human_approval", "finalize")
    g.add_edge("finalize", END)
    return g.compile(checkpointer=checkpointer)


if __name__ == "__main__":
    graph = build_graph(MemorySaver())
    cfg = {"configurable": {"thread_id": "demo"}}
    out = graph.invoke({"request": {"type": "booking", "hotel": "Sofitel", "amount": 900}}, cfg)
    print("Paused:", out.get("__interrupt__"))
    print("Next node:", graph.get_state(cfg).next)
    print("After approval:", graph.invoke(Command(resume=True), cfg)["status"])

# @@lg-approval-workflow:tests
def _cfg(t):
    return {"configurable": {"thread_id": t}}


def test_question_route():
    """Câu hỏi đi nhánh answer_question"""
    out = build_graph().invoke({"request": {"type": "question", "text": "Giờ check-in?"}})
    assert out["status"] == "answered" and "draft" not in out, out


def test_small_booking_auto_confirmed():
    """Đặt phòng nhỏ (<= 500) được xác nhận ngay, không interrupt"""
    out = build_graph(MemorySaver()).invoke({"request": {"type": "booking", "hotel": "Mường Thanh", "amount": 120}}, _cfg("a"))
    assert out["status"] == "confirmed" and "__interrupt__" not in out, out


def test_invalid_booking():
    """amount <= 0 hoặc thiếu hotel -> 'invalid' và không hỏi người duyệt"""
    out = build_graph(MemorySaver()).invoke({"request": {"type": "booking", "amount": 0}}, _cfg("b"))
    assert out["status"] == "invalid", out
    assert "amount must be > 0" in out["errors"] and "hotel is required" in out["errors"], out["errors"]


def test_large_booking_pauses():
    """Đặt phòng lớn -> dừng ở human_approval, trả về payload interrupt"""
    g = build_graph(MemorySaver())
    out = g.invoke({"request": {"type": "booking", "hotel": "Sofitel", "amount": 900}}, _cfg("c"))
    assert out.get("__interrupt__") and out["__interrupt__"][0]["amount"] == 900, out
    assert "status" not in out
    assert g.get_state(_cfg("c")).next == ("human_approval",), g.get_state(_cfg("c")).next


def test_resume_approve_and_reject():
    """Command(resume=True) -> confirmed; Command(resume=False) -> rejected"""
    g = build_graph(MemorySaver())
    req = {"request": {"type": "booking", "hotel": "Sofitel", "amount": 900}}
    g.invoke(req, _cfg("yes"))
    g.invoke(req, _cfg("no"))
    assert g.invoke(Command(resume=True), _cfg("yes"))["status"] == "confirmed"
    assert g.invoke(Command(resume=False), _cfg("no"))["status"] == "rejected"
