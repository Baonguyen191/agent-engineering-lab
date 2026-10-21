"""A tiny StateGraph for learning, modelled on LangGraph's public API.

This is NOT LangGraph. It re-implements the core ideas in ~200 lines so they can run
in the browser: state + reducers, nodes, (conditional) edges, supersteps (parallel
fan-out), checkpointing per thread, interrupt()/Command(resume=...), recursion limit,
node retries and subgraphs. Names match LangGraph where the behaviour matches.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

START = "__start__"
END = "__end__"


class GraphRecursionError(RuntimeError):
    pass


class InvalidUpdateError(RuntimeError):
    pass


class GraphInterrupt(Exception):
    def __init__(self, value: Any):
        super().__init__(value)
        self.value = value


@dataclass
class Command:
    """Pass `Command(resume=value)` to `invoke` to continue an interrupted thread."""

    resume: Any = None


_MISSING = object()


class _Ctx:
    resume: Any = _MISSING


_ctx = _Ctx()


def interrupt(value: Any) -> Any:
    """Pause the graph. Returns the resume value when the node is re-run after Command(resume=...)."""
    if _ctx.resume is not _MISSING:
        v, _ctx.resume = _ctx.resume, _MISSING
        return v
    raise GraphInterrupt(value)


def add_messages(left: list | None, right: Any) -> list:
    """Default list reducer: append (LangGraph's version also merges by message id)."""
    return list(left or []) + (list(right) if isinstance(right, list) else [right])


@dataclass
class Checkpoint:
    values: dict
    next: list[str]
    step: int
    pending_interrupt: Any = None


@dataclass
class StateSnapshot:
    values: dict
    next: tuple[str, ...]


class MemorySaver:
    """In-memory checkpointer: thread_id -> list of checkpoints (latest last)."""

    def __init__(self):
        self.storage: dict[str, list[Checkpoint]] = {}

    def put(self, thread_id: str, cp: Checkpoint) -> None:
        self.storage.setdefault(thread_id, []).append(cp)

    def latest(self, thread_id: str) -> Checkpoint | None:
        items = self.storage.get(thread_id)
        return items[-1] if items else None


InMemorySaver = MemorySaver


@dataclass
class _Node:
    fn: Callable[[dict], Any]
    retry: int = 0


class StateGraph:
    def __init__(self, reducers: dict[str, Callable[[Any, Any], Any]] | None = None):
        self.reducers = dict(reducers or {})
        self.nodes: dict[str, _Node] = {}
        self.edges: dict[str, list[str]] = {}
        self.branches: dict[str, tuple[Callable[[dict], Any], dict | None]] = {}

    def add_node(self, name: str, fn: Callable[[dict], Any], retry: int = 0) -> "StateGraph":
        if name in (START, END) or name in self.nodes:
            raise ValueError(f"Invalid or duplicate node name: {name}")
        self.nodes[name] = _Node(fn, retry)
        return self

    def add_edge(self, src: str, dst: str) -> "StateGraph":
        self.edges.setdefault(src, []).append(dst)
        return self

    def add_conditional_edges(self, src: str, router: Callable[[dict], Any], mapping: dict | None = None):
        self.branches[src] = (router, mapping)
        return self

    def compile(self, checkpointer: MemorySaver | None = None, recursion_limit: int = 25) -> "CompiledGraph":
        if START not in self.edges and START not in self.branches:
            raise ValueError("Graph needs an entry point: add_edge(START, '<node>')")
        for src, dsts in self.edges.items():
            for n in [src, *dsts]:
                if n not in self.nodes and n not in (START, END):
                    raise ValueError(f"Edge refers to unknown node '{n}'")
        return CompiledGraph(self, checkpointer, recursion_limit)


class CompiledGraph:
    def __init__(self, g: StateGraph, checkpointer: MemorySaver | None, recursion_limit: int):
        self.g = g
        self.checkpointer = checkpointer
        self.recursion_limit = recursion_limit

    # ------------------------------------------------------------------ helpers
    def _merge(self, state: dict, updates: list[dict]) -> dict:
        new = dict(state)
        written: set[str] = set()
        for upd in updates:
            if not upd:
                continue
            if not isinstance(upd, dict):
                raise InvalidUpdateError(f"Node must return a dict, got {type(upd).__name__}")
            for k, v in upd.items():
                if k in self.g.reducers:
                    new[k] = self.g.reducers[k](new.get(k), v)
                elif k in written:
                    raise InvalidUpdateError(f"Key '{k}' written by two nodes in one step without a reducer")
                else:
                    new[k] = v
                written.add(k)
        return new

    def _successors(self, node: str, state: dict) -> list[str]:
        if node in self.g.branches:
            router, mapping = self.g.branches[node]
            out = router(state)
            outs = out if isinstance(out, list) else [out]
            return [mapping[o] if mapping else o for o in outs]
        return list(self.g.edges.get(node, []))

    def _thread(self, config: dict | None) -> str | None:
        return ((config or {}).get("configurable") or {}).get("thread_id")

    def _call(self, name: str, state: dict) -> dict:
        node = self.g.nodes[name]
        for attempt in range(node.retry + 1):
            try:
                return node.fn(copy.deepcopy(state)) or {}
            except GraphInterrupt:
                raise
            except Exception:
                if attempt == node.retry:
                    raise
        return {}

    # ------------------------------------------------------------------ execution
    def _events(self, inp: Any, config: dict | None) -> Iterator[tuple[str, Any]]:
        thread = self._thread(config)
        if isinstance(inp, Command):
            cp = self.checkpointer.latest(thread) if (self.checkpointer and thread) else None
            if cp is None or not cp.next:
                raise RuntimeError("Nothing to resume for this thread")
            state, frontier, step = dict(cp.values), list(cp.next), cp.step
            _ctx.resume = inp.resume
        else:
            prev = self.checkpointer.latest(thread) if (self.checkpointer and thread) else None
            state = self._merge(dict(prev.values) if prev else {}, [inp])
            frontier = self._successors(START, state)
            step = 0

        frontier = [n for n in frontier if n != END]
        try:
            while frontier:
                step += 1
                if step > self.recursion_limit:
                    raise GraphRecursionError(f"Recursion limit of {self.recursion_limit} reached")
                updates: list[dict] = []
                for i, name in enumerate(frontier):
                    try:
                        upd = self._call(name, state)
                    except GraphInterrupt as gi:
                        state = self._merge(state, updates)
                        if self.checkpointer and thread:
                            self.checkpointer.put(thread, Checkpoint(state, frontier[i:], step - 1, gi.value))
                        yield ("interrupt", gi.value)
                        yield ("values", state)
                        return
                    updates.append(upd)
                    yield ("updates", {name: upd})
                state = self._merge(state, updates)
                nxt: list[str] = []
                for name in frontier:
                    for s in self._successors(name, state):
                        if s != END and s not in nxt:
                            nxt.append(s)
                frontier = nxt
                if self.checkpointer and thread:
                    self.checkpointer.put(thread, Checkpoint(state, list(frontier), step))
                yield ("values", state)
            if self.checkpointer and thread and step == 0:
                self.checkpointer.put(thread, Checkpoint(state, [], step))
            yield ("values", state)
        finally:
            _ctx.resume = _MISSING

    def invoke(self, inp: Any, config: dict | None = None) -> dict:
        final: dict = {}
        interrupts: list = []
        for kind, data in self._events(inp, config):
            if kind == "values":
                final = data
            elif kind == "interrupt":
                interrupts.append(data)
        return {**final, "__interrupt__": interrupts} if interrupts else final

    def stream(self, inp: Any, config: dict | None = None, stream_mode: str = "updates") -> Iterator[Any]:
        last = None
        for kind, data in self._events(inp, config):
            if kind == "interrupt":
                yield {"__interrupt__": [data]}
            elif kind == stream_mode:
                if stream_mode == "values" and data is last:
                    continue
                last = data
                yield data

    def get_state(self, config: dict) -> StateSnapshot:
        cp = self.checkpointer.latest(self._thread(config)) if self.checkpointer else None
        return StateSnapshot(dict(cp.values), tuple(cp.next)) if cp else StateSnapshot({}, ())

    def get_state_history(self, config: dict) -> list[StateSnapshot]:
        items = self.checkpointer.storage.get(self._thread(config), []) if self.checkpointer else []
        return [StateSnapshot(dict(c.values), tuple(c.next)) for c in reversed(items)]

    def __call__(self, state: dict) -> dict:
        """Lets a compiled graph be used as a node of another graph (subgraph)."""
        return self.invoke(state)
