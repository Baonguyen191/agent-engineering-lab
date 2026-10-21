# @@deep-agent-todos:starter
from dataclasses import dataclass, field


@dataclass
class Todo:
    id: str
    title: str
    worker: str
    depends_on: list[str] = field(default_factory=list)
    status: str = "pending"  # pending | in_progress | done | failed | blocked
    attempts: int = 0
    error: str = ""


class TodoList:
    def __init__(self):
        self.items: dict[str, Todo] = {}

    def add(self, todo: Todo) -> None:
        """Raise ValueError on duplicate id."""
        # TODO
        raise NotImplementedError

    def ready(self) -> list[Todo]:
        """Pending todos whose dependencies are all 'done', in insertion order."""
        # TODO
        raise NotImplementedError

    def summary(self) -> dict[str, int]:
        """Count of todos per status, only for statuses that occur, e.g. {"done": 3, "failed": 1}."""
        # TODO
        raise NotImplementedError


class VirtualFS:
    """Agent scratch space (Deep Agents keep notes/artifacts in a filesystem to save context)."""

    def __init__(self):
        self.files: dict[str, str] = {}

    def write(self, path: str, content: str) -> None:
        """Paths must be absolute ('/...'); otherwise ValueError."""
        # TODO
        raise NotImplementedError

    def read(self, path: str) -> str:
        """FileNotFoundError if missing."""
        # TODO
        raise NotImplementedError

    def ls(self, prefix: str = "/") -> list[str]:
        """Sorted paths starting with prefix."""
        # TODO
        raise NotImplementedError


def run_plan(task: str, planner, workers: dict, fs: VirtualFS, max_retries: int = 1) -> TodoList:
    """1. todos = planner(task) -> list of dicts (id, title, worker, depends_on); add them to a TodoList
    2. repeat: take todos.ready(); stop when empty
       for each: status 'in_progress'; call workers[todo.worker](todo, fs)
         success -> 'done'; exception -> attempts += 1 and retry until attempts > max_retries,
         then 'failed' with error=str(exception)   (unknown worker counts as an exception)
       attempts counts every call, successful or not
    3. todos still 'pending' at the end can never run -> mark 'blocked'
    """
    # TODO
    raise NotImplementedError


# --- a travel planning task -------------------------------------------------
def travel_planner(task: str) -> list[dict]:
    return [
        {"id": "weather", "title": "Research weather", "worker": "researcher"},
        {"id": "sights", "title": "Research attractions", "worker": "researcher"},
        {"id": "draft", "title": "Draft itinerary", "worker": "writer", "depends_on": ["weather", "sights"]},
        {"id": "budget", "title": "Check budget", "worker": "accountant", "depends_on": ["draft"]},
        {"id": "report", "title": "Write final report", "worker": "writer", "depends_on": ["draft", "budget"]},
    ]


def researcher(todo, fs):
    fs.write(f"/research/{todo.id}.md", f"notes for {todo.title}")


def writer(todo, fs):
    notes = [fs.read(p) for p in fs.ls("/research/")]
    fs.write(f"/out/{todo.id}.md", f"{todo.title} based on {len(notes)} notes")


def accountant(todo, fs):
    fs.write("/out/budget.md", "total: 640 USD (within 700 USD)")


WORKERS = {"researcher": researcher, "writer": writer, "accountant": accountant}

if __name__ == "__main__":
    fs = VirtualFS()
    todos = run_plan("3 ngày ở Đà Lạt, 700 USD", travel_planner, WORKERS, fs)
    for t in todos.items.values():
        print(f"[{t.status:>7}] {t.title} (attempts={t.attempts})")
    print(fs.ls())

# @@deep-agent-todos:solution
from dataclasses import dataclass, field


@dataclass
class Todo:
    id: str
    title: str
    worker: str
    depends_on: list[str] = field(default_factory=list)
    status: str = "pending"
    attempts: int = 0
    error: str = ""


class TodoList:
    def __init__(self):
        self.items: dict[str, Todo] = {}

    def add(self, todo: Todo) -> None:
        if todo.id in self.items:
            raise ValueError(f"duplicate todo id: {todo.id}")
        self.items[todo.id] = todo

    def ready(self) -> list[Todo]:
        def done(dep: str) -> bool:
            return dep in self.items and self.items[dep].status == "done"

        return [t for t in self.items.values() if t.status == "pending" and all(done(d) for d in t.depends_on)]

    def summary(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for t in self.items.values():
            out[t.status] = out.get(t.status, 0) + 1
        return out


class VirtualFS:
    def __init__(self):
        self.files: dict[str, str] = {}

    def write(self, path: str, content: str) -> None:
        if not path.startswith("/"):
            raise ValueError("path must be absolute")
        self.files[path] = content

    def read(self, path: str) -> str:
        if path not in self.files:
            raise FileNotFoundError(path)
        return self.files[path]

    def ls(self, prefix: str = "/") -> list[str]:
        return sorted(p for p in self.files if p.startswith(prefix))


def run_plan(task: str, planner, workers: dict, fs: VirtualFS, max_retries: int = 1) -> TodoList:
    todos = TodoList()
    for step in planner(task):
        todos.add(Todo(**step))
    while True:
        ready = todos.ready()
        if not ready:
            break
        for todo in ready:
            todo.status = "in_progress"
            while True:
                todo.attempts += 1
                try:
                    workers[todo.worker](todo, fs)
                    todo.status = "done"
                    break
                except Exception as e:  # retry, then record the failure for the planner/human
                    if todo.attempts > max_retries:
                        todo.status, todo.error = "failed", str(e)
                        break
    for todo in todos.items.values():
        if todo.status == "pending":
            todo.status = "blocked"
    return todos


def travel_planner(task: str) -> list[dict]:
    return [
        {"id": "weather", "title": "Research weather", "worker": "researcher"},
        {"id": "sights", "title": "Research attractions", "worker": "researcher"},
        {"id": "draft", "title": "Draft itinerary", "worker": "writer", "depends_on": ["weather", "sights"]},
        {"id": "budget", "title": "Check budget", "worker": "accountant", "depends_on": ["draft"]},
        {"id": "report", "title": "Write final report", "worker": "writer", "depends_on": ["draft", "budget"]},
    ]


def researcher(todo, fs):
    fs.write(f"/research/{todo.id}.md", f"notes for {todo.title}")


def writer(todo, fs):
    notes = [fs.read(p) for p in fs.ls("/research/")]
    fs.write(f"/out/{todo.id}.md", f"{todo.title} based on {len(notes)} notes")


def accountant(todo, fs):
    fs.write("/out/budget.md", "total: 640 USD (within 700 USD)")


WORKERS = {"researcher": researcher, "writer": writer, "accountant": accountant}

if __name__ == "__main__":
    fs = VirtualFS()
    todos = run_plan("3 ngày ở Đà Lạt, 700 USD", travel_planner, WORKERS, fs)
    for t in todos.items.values():
        print(f"[{t.status:>7}] {t.title} (attempts={t.attempts})")
    print(fs.ls())

# @@deep-agent-todos:tests
def test_todolist_basics():
    """ready() tôn trọng phụ thuộc; add() chặn id trùng"""
    tl = TodoList()
    tl.add(Todo("a", "A", "w"))
    tl.add(Todo("b", "B", "w", ["a"]))
    assert [t.id for t in tl.ready()] == ["a"]
    tl.items["a"].status = "done"
    assert [t.id for t in tl.ready()] == ["b"]
    try:
        tl.add(Todo("a", "dup", "w"))
    except ValueError:
        return
    raise AssertionError("duplicate id phải raise ValueError")


def test_virtual_fs():
    """VirtualFS: write/read/ls và lỗi đường dẫn"""
    fs = VirtualFS()
    fs.write("/b.md", "2")
    fs.write("/a.md", "1")
    assert fs.ls() == ["/a.md", "/b.md"] and fs.read("/a.md") == "1"
    for bad in [lambda: fs.write("rel.md", "x"), lambda: fs.read("/missing.md")]:
        try:
            bad()
        except (ValueError, FileNotFoundError):
            continue
        raise AssertionError("phải raise lỗi")


def test_happy_path():
    """Mọi việc hoàn thành theo đúng thứ tự phụ thuộc, artifact nằm trong FS"""
    fs = VirtualFS()
    todos = run_plan("trip", travel_planner, WORKERS, fs)
    assert todos.summary() == {"done": 5}, todos.summary()
    assert fs.read("/out/draft.md") == "Draft itinerary based on 2 notes"
    assert "/out/report.md" in fs.ls("/out/")


def test_retry_recovers_flaky_worker():
    """Worker lỗi 1 lần rồi chạy được -> done với attempts == 2"""
    state = {"n": 0}

    def flaky(todo, fs):
        state["n"] += 1
        if state["n"] == 1:
            raise TimeoutError("search API timeout")
        fs.write("/out/budget.md", "ok")

    todos = run_plan("trip", travel_planner, {**WORKERS, "accountant": flaky}, VirtualFS(), max_retries=1)
    budget = todos.items["budget"]
    assert budget.status == "done" and budget.attempts == 2, budget


def test_failure_blocks_dependents():
    """Worker luôn lỗi -> failed (kèm error), việc phụ thuộc bị blocked, việc độc lập vẫn xong"""
    def broken(todo, fs):
        raise RuntimeError("budget service down")

    todos = run_plan("trip", travel_planner, {**WORKERS, "accountant": broken}, VirtualFS(), max_retries=1)
    b = todos.items["budget"]
    assert b.status == "failed" and b.attempts == 2 and "down" in b.error, b
    assert todos.items["report"].status == "blocked"
    assert todos.summary() == {"done": 3, "failed": 1, "blocked": 1}, todos.summary()


def test_unknown_worker_fails():
    """Planner chỉ định worker không tồn tại -> failed thay vì crash"""
    plan = lambda task: [{"id": "x", "title": "X", "worker": "ghost"}]
    todos = run_plan("t", plan, WORKERS, VirtualFS(), max_retries=0)
    assert todos.items["x"].status == "failed", todos.items["x"]
