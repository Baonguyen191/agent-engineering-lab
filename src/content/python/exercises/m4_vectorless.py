# @@vectorless-tree:starter
import re
from dataclasses import dataclass, field

from labkit.rag import cosine, embed, tokenize

HANDBOOK = """# Travel Policy Handbook
Company rules for business travel.
## Flights
Rules for air travel.
### Booking
Book economy class at least 14 days in advance through the portal.
### Refunds
Refundable only if cancelled 24 hours before departure; the airline fee is deducted.
## Hotels
Rules for accommodation.
### Booking
Must cost under 120 USD per night; book through the portal.
### Refunds
Refundable if cancelled 48 hours before check-in.
## Meals
Daily food expenses.
### Allowance
The daily allowance is 40 USD; alcohol is not reimbursed.
"""

# (question, expected section path "Parent/Child")
QUESTIONS = [
    ("How many hours before check-in must a hotel be cancelled to get a refund?", "Hotels/Refunds"),
    ("Flight refund: how many hours before departure must I cancel?", "Flights/Refunds"),
    ("How far in advance should flights be booked?", "Flights/Booking"),
    ("What is the maximum hotel price per night?", "Hotels/Booking"),
    ("What is the daily meal allowance?", "Meals/Allowance"),
    ("Is a hotel refund possible?", "Hotels/Refunds"),
]


def terms(text: str) -> set[str]:
    """Tokens with a crude stemmer so 'refunds'/'refundable' match 'refund'."""
    out = set()
    for t in tokenize(text):
        for suffix in ("able", "ing", "ed", "s"):
            if len(t) > 4 and t.endswith(suffix):
                t = t[: -len(suffix)]
                break
        out.add(t)
    return out


@dataclass
class Node:
    title: str
    level: int
    text: str = ""
    children: list["Node"] = field(default_factory=list)


def build_tree(markdown: str) -> Node:
    """Parse '#'-headings into a tree. Root = Node("ROOT", 0).
    Lines that are not headings become the `text` of the most recent heading (join with spaces).
    A heading of level L becomes a child of the closest previous heading with level < L."""
    # TODO
    raise NotImplementedError


def subtree_text(node: Node) -> str:
    return " ".join([node.title, node.text] + [subtree_text(c) for c in node.children])


def navigate(root: Node, query: str) -> list[str]:
    """Reasoning-style descent (no vectors): starting at root, repeatedly pick the child with the
    highest score until reaching a leaf. Return the list of titles visited (excluding ROOT).
    score(child) = 2 * |terms(query) ∩ terms(child.title)| + |terms(query) ∩ terms(subtree_text(child))|
    Ties go to the first child."""
    # TODO
    raise NotImplementedError


def flat_chunks(root: Node) -> list[tuple[str, str]]:
    """Baseline: every leaf section becomes a chunk WITHOUT its headings, like naive chunking."""
    out = []

    def walk(node: Node, path: list[str]):
        if not node.children and node.level > 0:
            out.append(("/".join(path[-2:]), node.text))
        for c in node.children:
            walk(c, path + [c.title])

    walk(root, [])
    return out


def flat_retrieve(root: Node, query: str) -> str:
    q = embed(query)
    best = max(flat_chunks(root), key=lambda ch: cosine(q, embed(ch[1])))
    return best[0]


def evaluate(root: Node, questions=QUESTIONS) -> dict:
    """Return {"tree": accuracy, "flat": accuracy} where accuracy is the share of questions whose
    retrieved section path ("Parent/Child") equals the expected one.
    For the tree, the path is the last two titles returned by navigate()."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    root = build_tree(HANDBOOK)
    for q, expected in QUESTIONS:
        print(f"{q}\n  tree: {'/'.join(navigate(root, q))}   flat: {flat_retrieve(root, q)}   expected: {expected}")
    print(evaluate(root))

# @@vectorless-tree:solution
import re
from dataclasses import dataclass, field

from labkit.rag import cosine, embed, tokenize

HANDBOOK = """# Travel Policy Handbook
Company rules for business travel.
## Flights
Rules for air travel.
### Booking
Book economy class at least 14 days in advance through the portal.
### Refunds
Refundable only if cancelled 24 hours before departure; the airline fee is deducted.
## Hotels
Rules for accommodation.
### Booking
Must cost under 120 USD per night; book through the portal.
### Refunds
Refundable if cancelled 48 hours before check-in.
## Meals
Daily food expenses.
### Allowance
The daily allowance is 40 USD; alcohol is not reimbursed.
"""

QUESTIONS = [
    ("How many hours before check-in must a hotel be cancelled to get a refund?", "Hotels/Refunds"),
    ("Flight refund: how many hours before departure must I cancel?", "Flights/Refunds"),
    ("How far in advance should flights be booked?", "Flights/Booking"),
    ("What is the maximum hotel price per night?", "Hotels/Booking"),
    ("What is the daily meal allowance?", "Meals/Allowance"),
    ("Is a hotel refund possible?", "Hotels/Refunds"),
]


def terms(text: str) -> set[str]:
    out = set()
    for t in tokenize(text):
        for suffix in ("able", "ing", "ed", "s"):
            if len(t) > 4 and t.endswith(suffix):
                t = t[: -len(suffix)]
                break
        out.add(t)
    return out


@dataclass
class Node:
    title: str
    level: int
    text: str = ""
    children: list["Node"] = field(default_factory=list)


def build_tree(markdown: str) -> Node:
    root = Node("ROOT", 0)
    stack = [root]
    for line in markdown.splitlines():
        m = re.match(r"^(#+)\s+(.*)$", line)
        if m:
            node = Node(m.group(2).strip(), len(m.group(1)))
            while stack[-1].level >= node.level:
                stack.pop()
            stack[-1].children.append(node)
            stack.append(node)
        elif line.strip():
            cur = stack[-1]
            cur.text = f"{cur.text} {line.strip()}".strip()
    return root


def subtree_text(node: Node) -> str:
    return " ".join([node.title, node.text] + [subtree_text(c) for c in node.children])


def navigate(root: Node, query: str) -> list[str]:
    q = terms(query)
    path, node = [], root
    while node.children:
        node = max(
            node.children,
            key=lambda c: 2 * len(q & terms(c.title)) + len(q & terms(subtree_text(c))),
        )
        path.append(node.title)
    return path


def flat_chunks(root: Node) -> list[tuple[str, str]]:
    out = []

    def walk(node: Node, path: list[str]):
        if not node.children and node.level > 0:
            out.append(("/".join(path[-2:]), node.text))
        for c in node.children:
            walk(c, path + [c.title])

    walk(root, [])
    return out


def flat_retrieve(root: Node, query: str) -> str:
    q = embed(query)
    best = max(flat_chunks(root), key=lambda ch: cosine(q, embed(ch[1])))
    return best[0]


def evaluate(root: Node, questions=QUESTIONS) -> dict:
    tree_hits = sum("/".join(navigate(root, q)[-2:]) == exp for q, exp in questions)
    flat_hits = sum(flat_retrieve(root, q) == exp for q, exp in questions)
    return {"tree": tree_hits / len(questions), "flat": flat_hits / len(questions)}


if __name__ == "__main__":
    root = build_tree(HANDBOOK)
    for q, expected in QUESTIONS:
        print(f"{q}\n  tree: {'/'.join(navigate(root, q))}   flat: {flat_retrieve(root, q)}   expected: {expected}")
    print(evaluate(root))

# @@vectorless-tree:tests
def test_tree_shape():
    """ROOT -> 1 tài liệu -> 3 mục (Flights, Hotels, Meals) -> mục con"""
    root = build_tree(HANDBOOK)
    assert [c.title for c in root.children] == ["Travel Policy Handbook"]
    doc = root.children[0]
    assert [c.title for c in doc.children] == ["Flights", "Hotels", "Meals"], [c.title for c in doc.children]
    assert [c.title for c in doc.children[1].children] == ["Booking", "Refunds"]


def test_text_attached_to_heading():
    """Dòng thường thuộc về heading gần nhất phía trên"""
    hotels = build_tree(HANDBOOK).children[0].children[1]
    assert hotels.text == "Rules for accommodation."
    assert hotels.children[1].text == "Refundable if cancelled 48 hours before check-in."


def test_navigate_uses_structure():
    """Điều hướng theo cấu trúc phân biệt được Refunds của Hotels và của Flights"""
    root = build_tree(HANDBOOK)
    assert navigate(root, QUESTIONS[0][0]) == ["Travel Policy Handbook", "Hotels", "Refunds"]
    assert navigate(root, QUESTIONS[1][0])[-2:] == ["Flights", "Refunds"]


def test_evaluate_compares_methods():
    """Tree đúng 100% trên bộ câu hỏi; flat retrieval nhầm ít nhất 1 câu vì chunk mất ngữ cảnh heading"""
    result = evaluate(build_tree(HANDBOOK))
    assert set(result) == {"tree", "flat"}, result
    assert result["tree"] == 1.0, result
    assert result["flat"] < 1.0, result
