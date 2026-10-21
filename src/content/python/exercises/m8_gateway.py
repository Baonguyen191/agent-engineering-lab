# @@llm-gateway:starter
from dataclasses import dataclass

from labkit.llm import estimate_tokens


class ProviderError(Exception):
    """Transient provider failure (timeout, 5xx, overloaded)."""


class RateLimitError(Exception):
    pass


class GatewayError(Exception):
    pass


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class MockProvider:
    """Pretends to be a model provider. Fails `fail_times` times first, or always if always_fail."""

    def __init__(self, name: str, price_per_1k_tokens: float, fail_times: int = 0, always_fail: bool = False):
        self.name = name
        self.price_per_1k_tokens = price_per_1k_tokens
        self.fail_times = fail_times
        self.always_fail = always_fail
        self.calls = 0

    def complete(self, prompt: str) -> str:
        self.calls += 1
        if self.always_fail or self.calls <= self.fail_times:
            raise ProviderError(f"{self.name} unavailable")
        return f"[{self.name}] answer to: {prompt}"


@dataclass
class Response:
    text: str
    provider: str
    cached: bool
    cost: float
    tokens: int


class Gateway:
    """One entry point for many providers.

    routes: alias -> ordered list of providers (first = primary, rest = fallbacks)
    complete(alias, prompt):
      1. unknown alias -> GatewayError
      2. cache hit on (alias, prompt) -> Response(..., cached=True, cost=0.0); does not count toward the rate limit
      3. rate limit: at most `requests_per_minute` non-cached requests per alias in any 60-second window
         (use self.clock.time()); exceeding it -> RateLimitError
      4. for each provider in order: try up to max_retries + 1 times; ProviderError -> log and retry/fall back
      5. success: tokens = estimate_tokens(prompt) + estimate_tokens(text);
         cost = round(tokens / 1000 * provider.price_per_1k_tokens, 6); cache it; log it
      6. every provider failed -> GatewayError
    log: list of dicts {"alias", "provider", "ok", "cached", "tokens", "cost"} - one per provider attempt
    and one per cache hit (provider = provider of the cached response)
    """

    def __init__(self, routes: dict, max_retries: int = 1, requests_per_minute: int = 60, clock=None, cache: bool = True):
        self.routes = routes
        self.max_retries = max_retries
        self.requests_per_minute = requests_per_minute
        self.clock = clock or FakeClock()
        self.cache_enabled = cache
        self.cache: dict = {}
        self.log: list[dict] = []
        self._requests: dict[str, list[float]] = {}

    def complete(self, alias: str, prompt: str) -> Response:
        # TODO
        raise NotImplementedError

    def usage_summary(self) -> dict:
        """provider name -> {"requests": successful non-cached calls, "tokens": sum, "cost": rounded sum (6 dp)}"""
        # TODO
        raise NotImplementedError


if __name__ == "__main__":
    primary = MockProvider("openai/gpt-4o-mini", 0.6, fail_times=1)
    backup = MockProvider("groq/llama-3.3-70b", 0.8)
    gw = Gateway({"chat": [primary, backup]})
    print(gw.complete("chat", "Gợi ý lịch trình 2 ngày ở Huế"))
    print(gw.complete("chat", "Gợi ý lịch trình 2 ngày ở Huế"))  # cache hit
    for row in gw.log:
        print(row)
    print(gw.usage_summary())

# @@llm-gateway:solution
from dataclasses import dataclass

from labkit.llm import estimate_tokens


class ProviderError(Exception):
    """Transient provider failure (timeout, 5xx, overloaded)."""


class RateLimitError(Exception):
    pass


class GatewayError(Exception):
    pass


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class MockProvider:
    def __init__(self, name: str, price_per_1k_tokens: float, fail_times: int = 0, always_fail: bool = False):
        self.name = name
        self.price_per_1k_tokens = price_per_1k_tokens
        self.fail_times = fail_times
        self.always_fail = always_fail
        self.calls = 0

    def complete(self, prompt: str) -> str:
        self.calls += 1
        if self.always_fail or self.calls <= self.fail_times:
            raise ProviderError(f"{self.name} unavailable")
        return f"[{self.name}] answer to: {prompt}"


@dataclass
class Response:
    text: str
    provider: str
    cached: bool
    cost: float
    tokens: int


class Gateway:
    def __init__(self, routes: dict, max_retries: int = 1, requests_per_minute: int = 60, clock=None, cache: bool = True):
        self.routes = routes
        self.max_retries = max_retries
        self.requests_per_minute = requests_per_minute
        self.clock = clock or FakeClock()
        self.cache_enabled = cache
        self.cache: dict = {}
        self.log: list[dict] = []
        self._requests: dict[str, list[float]] = {}

    def _record(self, alias, provider, ok, cached=False, tokens=0, cost=0.0):
        self.log.append({"alias": alias, "provider": provider, "ok": ok, "cached": cached, "tokens": tokens, "cost": cost})

    def complete(self, alias: str, prompt: str) -> Response:
        if alias not in self.routes:
            raise GatewayError(f"unknown model alias '{alias}'")
        key = (alias, prompt)
        if self.cache_enabled and key in self.cache:
            hit = self.cache[key]
            self._record(alias, hit.provider, True, cached=True)
            return Response(hit.text, hit.provider, True, 0.0, hit.tokens)

        now = self.clock.time()
        window = [t for t in self._requests.get(alias, []) if now - t < 60]
        if len(window) >= self.requests_per_minute:
            raise RateLimitError(f"rate limit for '{alias}': {self.requests_per_minute}/min")
        self._requests[alias] = window + [now]

        for provider in self.routes[alias]:
            for _ in range(self.max_retries + 1):
                try:
                    text = provider.complete(prompt)
                except ProviderError:
                    self._record(alias, provider.name, False)
                    continue
                tokens = estimate_tokens(prompt) + estimate_tokens(text)
                cost = round(tokens / 1000 * provider.price_per_1k_tokens, 6)
                self._record(alias, provider.name, True, tokens=tokens, cost=cost)
                resp = Response(text, provider.name, False, cost, tokens)
                if self.cache_enabled:
                    self.cache[key] = resp
                return resp
        raise GatewayError(f"all providers failed for '{alias}'")

    def usage_summary(self) -> dict:
        out: dict = {}
        for row in self.log:
            if not row["ok"] or row["cached"]:
                continue
            s = out.setdefault(row["provider"], {"requests": 0, "tokens": 0, "cost": 0.0})
            s["requests"] += 1
            s["tokens"] += row["tokens"]
            s["cost"] = round(s["cost"] + row["cost"], 6)
        return out


if __name__ == "__main__":
    primary = MockProvider("openai/gpt-4o-mini", 0.6, fail_times=1)
    backup = MockProvider("groq/llama-3.3-70b", 0.8)
    gw = Gateway({"chat": [primary, backup]})
    print(gw.complete("chat", "Gợi ý lịch trình 2 ngày ở Huế"))
    print(gw.complete("chat", "Gợi ý lịch trình 2 ngày ở Huế"))  # cache hit
    for row in gw.log:
        print(row)
    print(gw.usage_summary())

# @@llm-gateway:tests
PROMPT = "Gợi ý lịch trình 2 ngày ở Huế"


def test_primary_success():
    """Provider chính hoạt động -> dùng provider chính, có tokens và cost"""
    a = MockProvider("A", 1.0)
    r = Gateway({"chat": [a, MockProvider("B", 2.0)]}).complete("chat", PROMPT)
    assert r.provider == "A" and r.cached is False and r.tokens > 0, r
    assert r.cost == round(r.tokens / 1000 * 1.0, 6), r


def test_retry_same_provider():
    """Lỗi tạm thời 1 lần -> retry chính provider đó và thành công"""
    a = MockProvider("A", 1.0, fail_times=1)
    gw = Gateway({"chat": [a, MockProvider("B", 2.0)]}, max_retries=1)
    assert gw.complete("chat", PROMPT).provider == "A" and a.calls == 2
    assert [(x["provider"], x["ok"]) for x in gw.log] == [("A", False), ("A", True)], gw.log


def test_fallback_to_next_provider():
    """Provider chính chết hẳn -> thử max_retries+1 lần rồi chuyển sang fallback"""
    a, b = MockProvider("A", 1.0, always_fail=True), MockProvider("B", 2.0)
    r = Gateway({"chat": [a, b]}, max_retries=1).complete("chat", PROMPT)
    assert r.provider == "B" and a.calls == 2 and b.calls == 1, (r, a.calls, b.calls)


def test_all_providers_fail():
    gw = Gateway({"chat": [MockProvider("A", 1, always_fail=True), MockProvider("B", 1, always_fail=True)]}, max_retries=0)
    try:
        gw.complete("chat", PROMPT)
    except GatewayError:
        assert len(gw.log) == 2 and not any(x["ok"] for x in gw.log), gw.log
        return
    raise AssertionError("phải raise GatewayError")


def test_unknown_alias():
    try:
        Gateway({"chat": [MockProvider("A", 1)]}).complete("gpt-9", PROMPT)
    except GatewayError:
        return
    raise AssertionError("alias lạ phải raise GatewayError")


def test_cache_hit_is_free():
    """Gọi lại cùng prompt -> trả từ cache, cost 0, không gọi provider"""
    a = MockProvider("A", 1.0)
    gw = Gateway({"chat": [a]})
    first = gw.complete("chat", PROMPT)
    second = gw.complete("chat", PROMPT)
    assert second.cached is True and second.cost == 0.0 and second.text == first.text, second
    assert a.calls == 1


def test_rate_limit_window():
    """Quá requests_per_minute trong 60 giây -> RateLimitError; sang phút mới thì gọi được"""
    clock = FakeClock()
    gw = Gateway({"chat": [MockProvider("A", 1.0)]}, requests_per_minute=2, clock=clock, cache=False)
    gw.complete("chat", "1")
    gw.complete("chat", "2")
    try:
        gw.complete("chat", "3")
        raise AssertionError("request thứ 3 trong 1 phút phải bị chặn")
    except RateLimitError:
        pass
    clock.advance(61)
    assert gw.complete("chat", "4").provider == "A"


def test_usage_summary():
    """Tổng hợp usage theo provider: chỉ tính lần gọi thành công, không tính cache"""
    a, b = MockProvider("A", 1.0, always_fail=True), MockProvider("B", 2.0)
    gw = Gateway({"chat": [a, b]}, max_retries=0)
    r1 = gw.complete("chat", "x" * 400)
    gw.complete("chat", "x" * 400)  # cache
    r2 = gw.complete("chat", "y" * 800)
    s = gw.usage_summary()
    assert set(s) == {"B"}, s
    assert s["B"]["requests"] == 2 and s["B"]["tokens"] == r1.tokens + r2.tokens, s
    assert s["B"]["cost"] == round(r1.cost + r2.cost, 6), s
