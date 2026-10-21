<!-- lesson: rag-intro -->
## Vấn đề: LLM không biết dữ liệu của bạn

LLM được huấn luyện trên dữ liệu công khai tới một thời điểm. Nó **không biết** chính sách nhân sự, tài liệu tài chính hay hướng dẫn nội bộ của công ty bạn — ví dụ video đưa ra là HR policy và finance policy ([xem đoạn định nghĩa](#t=18689)). Hỏi về chúng, model hoặc từ chối, hoặc tệ hơn: **bịa** (hallucination).

**RAG — Retrieval-Augmented Generation**: trước khi model trả lời, hệ thống *truy xuất* đoạn tài liệu liên quan từ kho tri thức bên ngoài và *đưa vào prompt* làm ngữ cảnh.

## Hai pipeline

```flow
Tài liệu (PDF, HTML, DB...) -> Load + parse thành Document
Load + parse thành Document -> Chunking
Chunking -> Embedding
Embedding -> Vector store
Câu hỏi -> Embedding câu hỏi
Embedding câu hỏi -> Similarity search
Similarity search -> Prompt = câu hỏi + context
Prompt = câu hỏi + context -> LLM trả lời có nguồn
```

- **Ingestion pipeline** (chạy trước, khi tài liệu thay đổi): load → chunk → embed → lưu.
- **Retrieval + generation** (mỗi câu hỏi): embed câu hỏi → tìm chunk gần nhất → ghép prompt → sinh câu trả lời.

## So sánh các lựa chọn

| Cách | Ưu | Nhược | Dùng khi |
|---|---|---|---|
| Nhồi toàn bộ tài liệu vào prompt | Đơn giản | Đắt, chậm, vượt context, model "lạc" giữa văn bản dài | Tài liệu rất ngắn |
| **RAG** | Dữ liệu cập nhật ngay, có trích nguồn, rẻ | Chất lượng phụ thuộc retrieval | Hỏi đáp trên kho tài liệu lớn, thay đổi |
| Fine-tuning | Thay đổi phong cách/kỹ năng của model | Đắt, khó cập nhật kiến thức, không trích nguồn | Dạy định dạng, giọng văn, tác vụ chuyên biệt |

> RAG đưa **kiến thức**; fine-tuning dạy **hành vi**. Hai thứ bổ sung cho nhau, không thay thế nhau.

**Lỗi tư duy thường gặp**

- Nghĩ RAG loại bỏ hoàn toàn hallucination — model vẫn có thể bỏ qua context hoặc suy diễn quá mức.
- Bỏ qua chất lượng ingestion: "garbage in, garbage out" — parse PDF lỗi thì retrieval tốt mấy cũng vô ích.

```selfcheck
Q: Công ty cập nhật chính sách hoàn tiền mỗi tuần. Chọn RAG hay fine-tuning?
A: RAG — chỉ cần index lại tài liệu; fine-tuning phải huấn luyện lại và không trích dẫn được nguồn.
Q: Bước nào của RAG chạy mỗi khi người dùng đặt câu hỏi?
A: Embed câu hỏi, similarity search, ghép prompt và gọi LLM. Load/chunk/embed tài liệu chạy trước trong ingestion pipeline.
```

<!-- lesson: rag-ingestion -->
## `Document`: đơn vị dữ liệu của LangChain

Mọi loader đều trả về danh sách `Document` gồm hai phần ([xem đoạn này](#t=19425)):

```python
from langchain_core.documents import Document

doc = Document(
    page_content="Hủy phòng trước 48 giờ được hoàn 100%.",
    metadata={"source": "policy/hotel.pdf", "page": 3, "author": "Ops team", "updated": "2026-09-01"},
)
```

**Metadata** không chỉ để trang trí: nó cho phép **lọc** (chỉ tìm trong tài liệu của phòng ban X), **trích dẫn** nguồn và **cập nhật** đúng tài liệu khi file thay đổi.

## Loaders

```python
from langchain_community.document_loaders import TextLoader, DirectoryLoader, PyPDFLoader

docs = TextLoader("data/text_files/python_intro.txt", encoding="utf-8").load()

docs = DirectoryLoader(
    "data/text_files", glob="**/*.txt", loader_cls=TextLoader, loader_kwargs={"encoding": "utf-8"}
).load()

pdf_docs = DirectoryLoader("data/pdf", glob="**/*.pdf", loader_cls=PyPDFLoader).load()   # mỗi trang một Document
```

Video lần lượt dùng [TextLoader](#t=20579), DirectoryLoader và các [PDF loader](#t=21174) (PyPDF, PyMuPDF). Mỗi loader có cách parse khác nhau — PDF có bảng, nhiều cột hay ảnh scan cần loader/OCR phù hợp.

## Chunking

Embedding một tài liệu 50 trang thành **một** vector làm loãng ý nghĩa; nhét cả tài liệu vào prompt thì tốn kém. Ta chia thành **chunk** ([xem đoạn splitter](#t=21345)):

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # ký tự tối đa mỗi chunk
    chunk_overlap=200,      # phần chồng lấp giữa hai chunk liên tiếp
    separators=["\n\n", "\n", " ", ""],
)
chunks = splitter.split_documents(pdf_docs)   # metadata được giữ cho từng chunk
```

**Đệ quy** nghĩa là: thử tách theo đoạn (`\n\n`); đoạn nào vẫn quá dài thì tách theo dòng, rồi theo từ — giữ các đơn vị ngữ nghĩa lớn nhất có thể.

```flow
Văn bản -> Tách theo \n\n
Tách theo \n\n -> Đoạn còn quá dài? tách theo \n
Đoạn còn quá dài? tách theo \n -> Vẫn dài? tách theo khoảng trắng
```

| chunk_size | Hệ quả |
|---|---|
| Quá nhỏ (vd 100) | Mất ngữ cảnh, câu trả lời rời rạc, nhiều chunk |
| Vừa (500–1000 ký tự) | Thường là điểm khởi đầu tốt cho văn bản |
| Quá lớn (vd 4000) | Vector loãng, retrieval kém chính xác, prompt đắt |

**Overlap** giúp câu nằm ở ranh giới không bị cắt mất ngữ cảnh. Quá nhiều overlap = trùng lặp và tốn chỗ.

**Lỗi thường gặp**

- Không lưu `source` trong metadata → không trích dẫn được.
- PDF scan (ảnh) → `page_content` rỗng; cần OCR.
- Một `chunk_size` cho mọi loại tài liệu — code, bảng, hội thoại cần chiến lược khác.

> Bài lab **Chunking có overlap** cho bạn tự viết splitter theo số từ.

```selfcheck
Q: Vì sao cần chunk_overlap?
A: Để thông tin nằm ở ranh giới hai chunk vẫn xuất hiện trọn vẹn trong ít nhất một chunk.
Q: Retrieval trả về đúng tài liệu nhưng đoạn quá dài và lan man. Điều chỉnh gì trước?
A: Giảm chunk_size (và kiểm tra lại overlap), rồi đo lại chất lượng retrieval.
```

<!-- lesson: rag-embeddings-retrieval -->
## Embedding

Embedding model biến văn bản thành vector số sao cho **văn bản có nghĩa gần nhau thì vector gần nhau**. Video dùng model mã nguồn mở `all-MiniLM-L6-v2` của sentence-transformers — mỗi văn bản thành vector **384 chiều** ([xem đoạn này](#t=21880)).

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
vectors = model.encode([c.page_content for c in chunks])   # shape (n_chunks, 384)
```

**Cosine similarity** đo góc giữa hai vector: 1 = cùng hướng (rất giống), 0 = không liên quan.

```text
cos(a, b) = (a · b) / (‖a‖ × ‖b‖)
```

## Vector store: ChromaDB

Video tự viết lớp `VectorStoreManager` quanh ChromaDB ([xem đoạn này](#t=22357)) — mỗi chunk lưu **id (UUID) + embedding + text + metadata**:

```python
import chromadb, uuid

client = chromadb.PersistentClient(path="data/vector_store")
collection = client.get_or_create_collection("pdf_documents")
collection.add(
    ids=[str(uuid.uuid4()) for _ in chunks],
    embeddings=vectors.tolist(),
    documents=[c.page_content for c in chunks],
    metadatas=[c.metadata for c in chunks],
)
print(collection.count())
```

## Retriever

```python
class RAGRetriever:
    def __init__(self, collection, embedder):
        self.collection, self.embedder = collection, embedder

    def retrieve(self, query: str, top_k: int = 5, score_threshold: float = 0.0, where: dict | None = None):
        q = self.embedder.encode([query]).tolist()
        res = self.collection.query(query_embeddings=q, n_results=top_k, where=where)
        hits = []
        for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
            score = 1 - dist                     # Chroma trả distance; đổi sang similarity
            if score >= score_threshold:
                hits.append({"content": text, "metadata": meta, "score": score})
        return hits
```

Video thử với câu hỏi về cơ chế attention trên PDF bài báo khoa học ([xem đoạn retriever](#t=22974)).

| Thành phần | Lựa chọn phổ biến |
|---|---|
| Embedding | sentence-transformers (local, miễn phí), OpenAI `text-embedding-3-small`, Cohere |
| Vector store | Chroma, FAISS (in-memory), pgvector, Qdrant, Pinecone, Typesense |
| Khoảng cách | Cosine (phổ biến nhất), dot product, L2 |

**Lỗi thường gặp**

- Index bằng model A, query bằng model B → vector không cùng không gian, kết quả vô nghĩa.
- Nhầm distance với similarity (distance nhỏ = giống).
- Luôn trả top-k dù điểm rất thấp → đưa rác vào prompt. Hãy đặt ngưỡng.

```selfcheck
Q: Bạn đổi embedding model nhưng không index lại tài liệu. Chuyện gì xảy ra?
A: Vector câu hỏi và vector tài liệu thuộc hai không gian khác nhau; similarity vô nghĩa, retrieval hỏng.
Q: Chỉ muốn tìm trong tài liệu của phòng HR. Dùng gì?
A: Metadata filter (vd `where={"department": "HR"}`) — cần lưu metadata đó lúc ingestion.
```

<!-- lesson: rag-generation -->
## Ghép tất cả: RAG pipeline

```python
from langchain.chat_models import init_chat_model

llm = init_chat_model("groq:llama-3.3-70b-versatile", temperature=0)

PROMPT = """Use ONLY the context below to answer. If the answer is not in the context, say you don't know.
Cite sources as [source].

Context:
{context}

Question: {question}
Answer:"""

def rag_simple(query: str, retriever, top_k: int = 3) -> str:
    hits = retriever.retrieve(query, top_k=top_k, score_threshold=0.2)
    if not hits:
        return "No relevant context found."
    context = "\n\n".join(f"[{h['metadata']['source']}] {h['content']}" for h in hits)
    return llm.invoke(PROMPT.format(context=context, question=query)).content
```

Video xây `rag_simple` ([xem đoạn này](#t=23909)) rồi nâng cấp thành phiên bản trả về **answer + sources + confidence** ([xem đoạn citation](#t=24171)):

```python
def rag_advanced(query, retriever, min_score=0.2):
    hits = retriever.retrieve(query, top_k=5, score_threshold=min_score)
    if not hits:
        return {"answer": "No relevant context found.", "sources": [], "confidence": 0.0}
    answer = llm.invoke(PROMPT.format(context=..., question=query)).content
    return {
        "answer": answer,
        "sources": [{"source": h["metadata"]["source"], "page": h["metadata"].get("page"), "preview": h["content"][:300]} for h in hits],
        "confidence": max(h["score"] for h in hits),
    }
```

## Grounding: trả lời dựa trên bằng chứng

```flow
Câu hỏi -> Retrieve
Retrieve -> Có chunk vượt ngưỡng?
Có chunk vượt ngưỡng? -> Có: sinh câu trả lời kèm [source]
Có chunk vượt ngưỡng? -> Không: nói rõ không tìm thấy
```

Ba lớp bảo vệ: **ngưỡng điểm** (không đưa rác vào prompt), **prompt** buộc chỉ dùng context và cho phép "không biết", **trích dẫn** để người dùng kiểm chứng.

## Code module hóa

Cuối phần RAG, video chuyển notebook thành package ([xem đoạn này](#t=24613)):

| File | Trách nhiệm |
|---|---|
| `src/data_loader.py` | Đọc mọi file hỗ trợ trong thư mục thành Document |
| `src/embedding.py` | Chunk + embed |
| `src/vectorstore.py` | Lưu/tải index (FAISS), tìm kiếm |
| `src/search.py` | Retrieval + gọi LLM, trả lời |
| `app.py` | Điểm vào: build index nếu chưa có, nhận câu hỏi |

Tách ingestion (chạy thỉnh thoảng) khỏi query (chạy mỗi request) giúp hệ thống nhanh và dễ test.

**Lỗi thường gặp**

- Prompt không cho phép "không biết" → model bịa khi context thiếu.
- Confidence lấy từ điểm retrieval bị hiểu nhầm là "xác suất câu trả lời đúng".
- Build lại index mỗi lần khởi động app → chậm, tốn tiền embedding.

> Bài lab **Mini-RAG có trích dẫn và biết từ chối** cài đặt đúng luồng này (với embedding toy để chạy trong trình duyệt).

```selfcheck
Q: Retriever không tìm thấy chunk nào vượt ngưỡng. Pipeline nên làm gì?
A: Trả lời rõ là không tìm thấy thông tin trong tài liệu, không gọi LLM với context rỗng để tránh bịa.
Q: Vì sao tách `data_loader`/`vectorstore` khỏi `search`?
A: Ingestion chạy hiếm và tốn kém; query chạy mỗi request. Tách ra để không index lại mỗi lần và test từng phần độc lập.
```

<!-- lesson: rag-advanced -->
> Bài bổ sung: video xây RAG nền tảng. Các kỹ thuật dưới đây là bước tiếp theo khi RAG cơ bản chưa đạt chất lượng — hãy đo trước (Module 7) rồi mới thêm.

## Hybrid retrieval: keyword + vector

Vector search giỏi tìm **ý nghĩa** ("hoàn tiền" ≈ "refund"), nhưng kém với **từ khóa chính xác**: mã sản phẩm `SKU-4471`, tên riêng, mã lỗi. BM25 (keyword) thì ngược lại. Kết hợp cả hai bằng **Reciprocal Rank Fusion**:

```python
def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return sorted(scores, key=scores.get, reverse=True)

final = rrf([bm25_ids, vector_ids])
```

## Reranking

Retriever lấy nhanh top-50 (recall cao), **cross-encoder reranker** chấm lại từng cặp (câu hỏi, chunk) chính xác hơn rồi giữ top-5:

```flow
Câu hỏi -> Retriever: top 50 (nhanh)
Retriever: top 50 (nhanh) -> Reranker cross-encoder: top 5 (chính xác)
Reranker cross-encoder: top 5 (chính xác) -> LLM
```

## Query transformation

| Kỹ thuật | Ý tưởng | Khi nào |
|---|---|---|
| Query rewriting | LLM viết lại câu hỏi rõ ràng, đầy đủ | Câu hỏi hội thoại ("còn cái kia thì sao?") |
| Multi-query | Sinh 3–5 cách hỏi, gộp kết quả | Câu hỏi mơ hồ |
| HyDE | LLM viết câu trả lời giả định, embed nó để tìm | Câu hỏi ngắn, tài liệu dài |
| Decomposition | Tách câu hỏi phức thành câu con | So sánh nhiều thực thể |

## Metadata filtering & self-query

Trích bộ lọc từ câu hỏi ("chính sách *năm 2026* của *phòng HR*") thành `where={"year": 2026, "dept": "HR"}` trước khi search — vừa nhanh vừa chính xác.

## Đánh giá retrieval

Đánh giá retrieval **tách riêng** khỏi generation. Với mỗi câu hỏi có danh sách chunk liên quan (ground truth):

- **Recall@k** = số chunk liên quan nằm trong top-k / tổng số chunk liên quan.
- **MRR** = trung bình của 1 / thứ hạng của chunk liên quan đầu tiên.

```python
def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant)
```

**Lỗi thường gặp**

- Thêm reranker/hybrid mà không có bộ đo → không biết có tốt hơn không.
- Chỉ đánh giá câu trả lời cuối → không biết lỗi nằm ở retrieval hay generation.

```selfcheck
Q: Người dùng tìm "lỗi E-4471" nhưng vector search trả về tài liệu chung chung về lỗi. Kỹ thuật nào giúp?
A: Hybrid retrieval: BM25 bắt chính xác chuỗi "E-4471", gộp với vector search bằng RRF.
Q: Recall@5 cao nhưng câu trả lời vẫn sai. Lỗi nhiều khả năng ở đâu?
A: Ở generation (prompt, model, context quá nhiều nhiễu) — retrieval đã mang đúng tài liệu về.
```
