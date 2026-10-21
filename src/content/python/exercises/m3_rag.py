# @@rag-chunking:starter
from labkit.rag import Document


def chunk_text(text: str, max_words: int = 50, overlap: int = 10) -> list[str]:
    """Split `text` into chunks of at most `max_words` words.
    Consecutive chunks share exactly `overlap` words. Every word must appear in some chunk.
    - empty / whitespace-only text -> []
    - raise ValueError if max_words <= 0, overlap < 0 or overlap >= max_words
    - stop as soon as a chunk reaches the last word (no tiny duplicate tail chunk)
    """
    # TODO
    raise NotImplementedError


def to_documents(chunks: list[str], source: str) -> list[Document]:
    """Wrap chunks into Documents with metadata {"source": source, "chunk": index}."""
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    text = " ".join(f"w{i}" for i in range(23))
    for c in chunk_text(text, max_words=10, overlap=3):
        print(c)

# @@rag-chunking:solution
from labkit.rag import Document


def chunk_text(text: str, max_words: int = 50, overlap: int = 10) -> list[str]:
    if max_words <= 0 or overlap < 0 or overlap >= max_words:
        raise ValueError("require max_words > 0 and 0 <= overlap < max_words")
    words = text.split()
    chunks: list[str] = []
    step = max_words - overlap
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start : start + max_words]))
        if start + max_words >= len(words):
            break
    return chunks


def to_documents(chunks: list[str], source: str) -> list[Document]:
    return [Document(c, {"source": source, "chunk": i}) for i, c in enumerate(chunks)]


if __name__ == "__main__":
    text = " ".join(f"w{i}" for i in range(23))
    for c in chunk_text(text, max_words=10, overlap=3):
        print(c)

# @@rag-chunking:tests
TEXT = " ".join(f"w{i}" for i in range(120))


def test_chunk_count_and_size():
    """120 từ, max 50, overlap 10 -> 3 chunk, chunk nào cũng <= 50 từ"""
    chunks = chunk_text(TEXT, 50, 10)
    assert len(chunks) == 3, len(chunks)
    assert all(len(c.split()) <= 50 for c in chunks)


def test_overlap_is_exact():
    """Cuối chunk i trùng đúng 10 từ với đầu chunk i+1"""
    chunks = chunk_text(TEXT, 50, 10)
    for a, b in zip(chunks, chunks[1:]):
        assert a.split()[-10:] == b.split()[:10], (a.split()[-10:], b.split()[:10])


def test_all_words_covered():
    """Không mất từ nào và không có chunk đuôi thừa"""
    chunks = chunk_text(TEXT, 50, 10)
    covered = set(w for c in chunks for w in c.split())
    assert covered == set(TEXT.split())
    assert chunks[-1].split()[-1] == "w119"
    assert len(chunk_text(" ".join(f"w{i}" for i in range(50)), 50, 10)) == 1, "50 từ vừa đủ 1 chunk"


def test_edge_cases():
    """Text rỗng -> []; text ngắn -> 1 chunk; tham số sai -> ValueError"""
    assert chunk_text("   ") == []
    assert chunk_text("xin chào", 50, 10) == ["xin chào"]
    for bad in [(10, 10), (10, 12), (0, 0), (10, -1)]:
        try:
            chunk_text(TEXT, *bad)
        except ValueError:
            continue
        raise AssertionError(f"chunk_text(max_words={bad[0]}, overlap={bad[1]}) phải raise ValueError")


def test_documents_metadata():
    """to_documents gắn source và số thứ tự chunk"""
    docs = to_documents(["a", "b"], "guide.md")
    assert [d.metadata for d in docs] == [{"source": "guide.md", "chunk": 0}, {"source": "guide.md", "chunk": 1}]
    assert docs[1].page_content == "b"

# @@rag-mini:starter
from labkit.rag import Document, cosine, embed, tokenize

CORPUS = [
    Document("Hội An nổi tiếng với phố cổ, đèn lồng và món cao lầu. Thời điểm đẹp nhất là tháng 2 đến tháng 4.", {"source": "guide/hoi-an.md", "city": "Hoi An"}),
    Document("Công dân nhiều nước được miễn thị thực 45 ngày khi nhập cảnh Việt Nam. Hãy kiểm tra quy định visa mới nhất trước chuyến đi.", {"source": "policy/visa.md", "city": None}),
    Document("Đà Lạt có khí hậu mát mẻ quanh năm. Nhiệt độ trung bình khoảng 18 độ C nên cần mang áo khoác.", {"source": "guide/da-lat.md", "city": "Da Lat"}),
    Document("Chính sách hoàn tiền khách sạn: hủy phòng trước 48 giờ được hoàn 100%. Hủy trong vòng 48 giờ bị tính phí một đêm.", {"source": "policy/hotel-refund.md", "city": None}),
    Document("Phú Quốc có nhiều bãi biển đẹp như Bãi Sao. Mùa khô từ tháng 11 đến tháng 4 là lúc lý tưởng để tắm biển.", {"source": "guide/phu-quoc.md", "city": "Phu Quoc"}),
    Document("Ở Hội An nên thuê xe đạp để dạo phố cổ. Vé tham quan phố cổ khoảng 120.000 đồng.", {"source": "guide/hoi-an-tips.md", "city": "Hoi An"}),
]

NO_ANSWER = "Không tìm thấy thông tin trong tài liệu."


def build_index(docs):
    """Return a list of (document, embed(document.page_content)) pairs."""
    # TODO
    raise NotImplementedError


def retrieve(index, query: str, k: int = 3, min_score: float = 0.2, where: dict | None = None):
    """Return up to k (document, score) pairs sorted by cosine score, highest first.
    Drop pairs with score < min_score. `where` filters on metadata equality before scoring,
    e.g. where={"city": "Hoi An"}."""
    # TODO
    raise NotImplementedError


def answer(query: str, index, min_score: float = 0.2) -> dict:
    """Grounded, extractive answer:
    - no hit -> {"answer": NO_ANSWER, "citations": [], "grounded": False}
    - otherwise take the top document, split it into sentences on ". ",
      pick the sentence sharing the most tokens with the query (tokenize()),
      and return {"answer": f"{sentence} [{source}]", "citations": [unique sources of hits, in order], "grounded": True}
    """
    # TODO
    raise NotImplementedError


if __name__ == "__main__":
    idx = build_index(CORPUS)
    for q in ["Hủy phòng khách sạn có được hoàn tiền không?", "Nhiệt độ ở Đà Lạt?", "Giá vé xem bóng đá ở Tokyo"]:
        print(q, "->", answer(q, idx))

# @@rag-mini:solution
from labkit.rag import Document, cosine, embed, tokenize

CORPUS = [
    Document("Hội An nổi tiếng với phố cổ, đèn lồng và món cao lầu. Thời điểm đẹp nhất là tháng 2 đến tháng 4.", {"source": "guide/hoi-an.md", "city": "Hoi An"}),
    Document("Công dân nhiều nước được miễn thị thực 45 ngày khi nhập cảnh Việt Nam. Hãy kiểm tra quy định visa mới nhất trước chuyến đi.", {"source": "policy/visa.md", "city": None}),
    Document("Đà Lạt có khí hậu mát mẻ quanh năm. Nhiệt độ trung bình khoảng 18 độ C nên cần mang áo khoác.", {"source": "guide/da-lat.md", "city": "Da Lat"}),
    Document("Chính sách hoàn tiền khách sạn: hủy phòng trước 48 giờ được hoàn 100%. Hủy trong vòng 48 giờ bị tính phí một đêm.", {"source": "policy/hotel-refund.md", "city": None}),
    Document("Phú Quốc có nhiều bãi biển đẹp như Bãi Sao. Mùa khô từ tháng 11 đến tháng 4 là lúc lý tưởng để tắm biển.", {"source": "guide/phu-quoc.md", "city": "Phu Quoc"}),
    Document("Ở Hội An nên thuê xe đạp để dạo phố cổ. Vé tham quan phố cổ khoảng 120.000 đồng.", {"source": "guide/hoi-an-tips.md", "city": "Hoi An"}),
]

NO_ANSWER = "Không tìm thấy thông tin trong tài liệu."


def build_index(docs):
    return [(d, embed(d.page_content)) for d in docs]


def retrieve(index, query: str, k: int = 3, min_score: float = 0.2, where: dict | None = None):
    q = embed(query)
    hits = []
    for doc, vec in index:
        if where and any(doc.metadata.get(key) != val for key, val in where.items()):
            continue
        score = cosine(q, vec)
        if score >= min_score:
            hits.append((doc, score))
    hits.sort(key=lambda h: h[1], reverse=True)
    return hits[:k]


def answer(query: str, index, min_score: float = 0.2) -> dict:
    hits = retrieve(index, query, min_score=min_score)
    if not hits:
        return {"answer": NO_ANSWER, "citations": [], "grounded": False}
    top = hits[0][0]
    q_tokens = set(tokenize(query))
    sentences = [s.strip().rstrip(".") for s in top.page_content.split(". ") if s.strip()]
    best = max(sentences, key=lambda s: len(q_tokens & set(tokenize(s))))
    citations: list[str] = []
    for doc, _ in hits:
        if doc.metadata["source"] not in citations:
            citations.append(doc.metadata["source"])
    return {"answer": f"{best}. [{top.metadata['source']}]", "citations": citations, "grounded": True}


if __name__ == "__main__":
    idx = build_index(CORPUS)
    for q in ["Hủy phòng khách sạn có được hoàn tiền không?", "Nhiệt độ ở Đà Lạt?", "Giá vé xem bóng đá ở Tokyo"]:
        print(q, "->", answer(q, idx))

# @@rag-mini:tests
def test_index():
    """Index có 1 vector đã chuẩn hóa cho mỗi document"""
    idx = build_index(CORPUS)
    assert len(idx) == len(CORPUS)
    norm = sum(v * v for v in idx[0][1]) ** 0.5
    assert abs(norm - 1) < 1e-6, norm


def test_retrieve_ranking():
    """Câu hỏi hoàn tiền -> tài liệu chính sách hoàn tiền đứng đầu; điểm giảm dần và >= min_score"""
    hits = retrieve(build_index(CORPUS), "Hủy phòng khách sạn có được hoàn tiền không?")
    assert hits, "phải có kết quả"
    assert hits[0][0].metadata["source"] == "policy/hotel-refund.md", [h[0].metadata["source"] for h in hits]
    scores = [s for _, s in hits]
    assert scores == sorted(scores, reverse=True) and all(s >= 0.2 for s in scores), scores


def test_metadata_filter():
    """where={'city': 'Hoi An'} chỉ trả tài liệu Hội An"""
    hits = retrieve(build_index(CORPUS), "phố cổ vé tham quan", where={"city": "Hoi An"}, min_score=0.0)
    assert hits and all(d.metadata["city"] == "Hoi An" for d, _ in hits), hits


def test_grounded_answer_with_citation():
    """Câu trả lời trích đúng câu chứa thông tin và kèm nguồn"""
    out = answer("Nhiệt độ trung bình ở Đà Lạt là bao nhiêu?", build_index(CORPUS))
    assert out["grounded"] is True, out
    assert "18 độ" in out["answer"] and "[guide/da-lat.md]" in out["answer"], out
    assert out["citations"][0] == "guide/da-lat.md"


def test_no_evidence_refuses():
    """Không có bằng chứng -> từ chối trả lời, không bịa"""
    out = answer("Giá vé xem bóng đá ở Tokyo", build_index(CORPUS))
    assert out == {"answer": NO_ANSWER, "citations": [], "grounded": False}, out
