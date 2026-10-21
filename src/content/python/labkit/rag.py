"""Retrieval helpers for the lab.

`embed()` is a TOY embedding: a hashed bag-of-words vector. It captures word overlap,
not meaning ("car" and "automobile" are unrelated to it). Real systems use a neural
embedding model (e.g. sentence-transformers all-MiniLM-L6-v2, 384 dimensions, as in
the RAG section of the course). It is deterministic, so tests can rely on it.
"""

from __future__ import annotations

import math
import re
import zlib
from dataclasses import dataclass, field

_WORD = re.compile(r"\w+", re.UNICODE)

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "of", "to", "in", "on", "for", "and", "or",
    "what", "which", "who", "how", "do", "does", "i", "my", "me", "it", "this", "that", "with",
    "be", "can", "at", "by", "from", "as", "about", "there", "any",
    "là", "và", "của", "có", "cho", "các", "những", "một", "được", "không", "gì", "nào", "thì",
}


@dataclass
class Document:
    page_content: str
    metadata: dict = field(default_factory=dict)


def tokenize(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in STOPWORDS]


def embed(text: str, dim: int = 256) -> list[float]:
    """Deterministic hashed bag-of-words, L2-normalised. See module docstring."""
    vec = [0.0] * dim
    for tok in tokenize(text):
        vec[zlib.crc32(tok.encode()) % dim] += 1.0
    vec = [math.log1p(v) for v in vec]
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm else vec


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
