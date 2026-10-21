"""Chat model abstraction for the lab.

Two implementations share one interface (`invoke(messages, tools=None) -> Message`):

* MockChatModel  - deterministic, rule/script based. No network, no cost. Default.
* RealChatModel  - calls an OpenAI-compatible /chat/completions endpoint.

`get_chat_model()` picks one from the LAB_LLM_MODE environment variable, which the
Coding Lab sets from the run-mode toggle. The mock does NOT understand language: it only
matches regular expressions you give it, so it is a tool for testing control flow.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable

# --------------------------------------------------------------------------- messages


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class Message:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None
    name: str | None = None
    usage: dict = field(default_factory=dict)


def system(content: str) -> Message:
    return Message("system", content)


def user(content: str) -> Message:
    return Message("user", content)


def assistant(content: str = "", tool_calls: list[ToolCall] | None = None) -> Message:
    return Message("assistant", content, tool_calls or [])


def tool_result(content: str, tool_call_id: str, name: str | None = None) -> Message:
    return Message("tool", content, tool_call_id=tool_call_id, name=name)


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 characters per token). Good enough for budgeting demos."""
    return max(1, len(text) // 4) if text else 0


# --------------------------------------------------------------------------- tools


_PY_TO_JSON = {str: "string", int: "integer", float: "number", bool: "boolean", list: "array", dict: "object"}


class Tool:
    """A callable with a JSON-schema description, similar to LangChain's @tool."""

    def __init__(self, fn: Callable, name: str | None = None, description: str | None = None):
        import inspect

        self.fn = fn
        self.name = name or fn.__name__
        self.description = (description or inspect.getdoc(fn) or "").strip()
        props: dict[str, Any] = {}
        required: list[str] = []
        for pname, p in inspect.signature(fn).parameters.items():
            ann = p.annotation if p.annotation is not inspect.Parameter.empty else str
            if isinstance(ann, str):  # postponed annotations
                ann = {"str": str, "int": int, "float": float, "bool": bool, "list": list, "dict": dict}.get(ann, str)
            props[pname] = {"type": _PY_TO_JSON.get(ann, "string")}
            if p.default is inspect.Parameter.empty:
                required.append(pname)
        self.parameters = {"type": "object", "properties": props, "required": required}

    def invoke(self, args: dict) -> Any:
        return self.fn(**args)

    def spec(self) -> dict:
        return {"name": self.name, "description": self.description, "parameters": self.parameters}

    def __call__(self, *a, **kw):
        return self.fn(*a, **kw)

    def __repr__(self) -> str:
        return f"Tool({self.name})"


def tool(fn: Callable | None = None, *, name: str | None = None, description: str | None = None):
    """Decorator: `@tool` or `@tool(name="x")`."""
    if fn is None:
        return lambda f: Tool(f, name=name, description=description)
    return Tool(fn, name=name, description=description)


# --------------------------------------------------------------------------- mock model


@dataclass
class MockRule:
    """If the last user message matches `when` (regex, case-insensitive) the mock answers.

    * `reply`      plain text answer
    * `calls`      list of (tool_name, args) to request instead of answering
    * `after_tool` answer template used once tool results are present; "{result}" is replaced
                   by the tool outputs joined with "; "
    """

    when: str
    reply: str | None = None
    calls: list[tuple[str, dict]] = field(default_factory=list)
    after_tool: str | None = None


class MockChatModel:
    """Deterministic stand-in for a chat model.

    Either give `rules` (pattern based, supports tool calling) or `script`
    (a list of replies returned in order; each item is a str or a Message).
    """

    def __init__(self, rules: list[MockRule] | None = None, script: list[Any] | None = None, name: str = "mock-model"):
        self.rules = rules or []
        self.script = list(script or [])
        self.name = name
        self.calls = 0
        self.history: list[list[Message]] = []
        self._ids = 0

    def _next_id(self) -> str:
        self._ids += 1
        return f"call_{self._ids}"

    def invoke(self, messages: list[Message], tools: list[Tool] | None = None) -> Message:
        self.calls += 1
        self.history.append(list(messages))
        prompt_tokens = sum(estimate_tokens(m.content) for m in messages)
        out = self._respond(messages, tools)
        out.usage = {"prompt_tokens": prompt_tokens, "completion_tokens": estimate_tokens(out.content)}
        return out

    def _respond(self, messages: list[Message], tools: list[Tool] | None) -> Message:
        if self.script:
            item = self.script.pop(0)
            return item if isinstance(item, Message) else assistant(str(item))

        last_idx = next((i for i in range(len(messages) - 1, -1, -1) if messages[i].role == "user"), -1)
        text = messages[last_idx].content if last_idx >= 0 else ""
        rule = next((r for r in self.rules if re.search(r.when, text, re.IGNORECASE)), None)
        if rule is None:
            return assistant("[mock] Không có rule nào khớp với câu hỏi này.")

        # Tool results already present after the last user turn -> final answer.
        results = [m.content for m in messages[last_idx + 1 :] if m.role == "tool"]
        if results:
            return assistant((rule.after_tool or "{result}").format(result="; ".join(results)))

        available = {t.name for t in (tools or [])}
        calls = [ToolCall(self._next_id(), n, dict(a)) for n, a in rule.calls if n in available]
        if calls:
            return assistant("", calls)
        return assistant(rule.reply or "[mock] Rule không có câu trả lời dạng text.")


# --------------------------------------------------------------------------- real model


def _post_json(url: str, headers: dict, payload: dict, timeout: float = 60) -> dict:
    body = json.dumps(payload)
    try:  # Pyodide: synchronous XHR implemented by the web worker
        from js import labBridge  # type: ignore

        raw = labBridge.postJsonSync(url, json.dumps(headers), body)
        data = json.loads(str(raw))
        if data.get("__error__"):
            raise RuntimeError(data["__error__"])
        return data
    except ImportError:  # CPython
        import urllib.request

        req = urllib.request.Request(url, data=body.encode(), headers={**headers, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())


class RealChatModel:
    """OpenAI-compatible chat completions client (OpenAI, Groq, OpenRouter, LiteLLM proxy, ...)."""

    def __init__(self, base_url: str, model: str, api_key: str, temperature: float = 0):
        self.base_url = base_url.rstrip("/")
        self.name = model
        self._key = api_key
        self.temperature = temperature
        self.calls = 0

    def invoke(self, messages: list[Message], tools: list[Tool] | None = None) -> Message:
        self.calls += 1
        payload: dict[str, Any] = {
            "model": self.name,
            "temperature": self.temperature,
            "messages": [self._to_wire(m) for m in messages],
        }
        if tools:
            payload["tools"] = [{"type": "function", "function": t.spec()} for t in tools]
        data = _post_json(f"{self.base_url}/chat/completions", {"Authorization": f"Bearer {self._key}"}, payload)
        choice = data["choices"][0]["message"]
        calls = [
            ToolCall(c["id"], c["function"]["name"], json.loads(c["function"].get("arguments") or "{}"))
            for c in choice.get("tool_calls") or []
        ]
        msg = assistant(choice.get("content") or "", calls)
        msg.usage = data.get("usage", {})
        return msg

    @staticmethod
    def _to_wire(m: Message) -> dict:
        d: dict[str, Any] = {"role": m.role, "content": m.content}
        if m.tool_calls:
            d["tool_calls"] = [
                {"id": c.id, "type": "function", "function": {"name": c.name, "arguments": json.dumps(c.args)}}
                for c in m.tool_calls
            ]
        if m.role == "tool":
            d["tool_call_id"] = m.tool_call_id
        return d


# --------------------------------------------------------------------------- factory


def llm_mode() -> str:
    return os.environ.get("LAB_LLM_MODE", "mock")


def get_chat_model(rules: list[MockRule] | None = None, script: list[Any] | None = None):
    """Mock by default; real when the lab runs in 'real' mode with credentials configured."""
    if llm_mode() == "real":
        base_url = os.environ.get("LAB_LLM_BASE_URL", "")
        model = os.environ.get("LAB_LLM_MODEL", "")
        key = os.environ.get("LAB_LLM_API_KEY", "")
        if not (base_url and model and key):
            raise RuntimeError("Real mode cần base URL, model và API key (cấu hình ở trang Cài đặt).")
        return RealChatModel(base_url, model, key)
    return MockChatModel(rules=rules, script=script)
