import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter, clientIpFrom, isLoopbackIp } from "@/lib/limiter";

describe("SlidingWindowLimiter", () => {
  it("max 까지 허용, 초과 거절, 윈도우 지나면 다시 허용", () => {
    const l = new SlidingWindowLimiter(3, 1000);
    const t0 = 1_000_000;
    expect(l.allow("a", t0)).toBe(true);
    expect(l.allow("a", t0 + 10)).toBe(true);
    expect(l.allow("a", t0 + 20)).toBe(true);
    expect(l.allow("a", t0 + 30)).toBe(false);
    expect(l.remaining("a", t0 + 30)).toBe(0);
    expect(l.retryAfterMs("a", t0 + 30)).toBe(970);
    // 다른 키는 독립
    expect(l.allow("b", t0 + 30)).toBe(true);
    // 첫 히트 만료 후 1건 허용
    expect(l.allow("a", t0 + 1001)).toBe(true);
    expect(l.allow("a", t0 + 1002)).toBe(false);
  });

  it("거절된 요청은 히트로 기록하지 않는다", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.allow("a", 0)).toBe(true);
    for (let i = 1; i < 50; i++) expect(l.allow("a", i)).toBe(false);
    expect(l.allow("a", 1000)).toBe(true);
  });
});

describe("clientIpFrom", () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });
  it("X-Real-IP 우선, 없으면 X-Forwarded-For 첫 홉, 둘 다 없으면 local", () => {
    expect(clientIpFrom(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIpFrom(h({}))).toBe("local");
  });
  it("isLoopbackIp", () => {
    expect(isLoopbackIp("127.0.0.1")).toBe(true);
    expect(isLoopbackIp("::1")).toBe(true);
    expect(isLoopbackIp("local")).toBe(true);
    expect(isLoopbackIp("8.8.8.8")).toBe(false);
  });
});
