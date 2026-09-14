/**
 * 프로세스 메모리 슬라이딩 윈도우 리미터. pm2 fork 1인스턴스 전제(인스턴스 간 공유 없음).
 * 키(유저 id, IP 등)별 windowMs 안의 히트 수가 max 를 넘으면 거절.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** 허용되면 기록하고 true. 거절이면 false(기록 안 함). */
  allow(key: string, now: number = Date.now()): boolean {
    this.sweep(now);
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }

  /** 남은 허용 횟수 */
  remaining(key: string, now: number = Date.now()): number {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    return Math.max(0, this.max - arr.length);
  }

  /** 다음 허용까지 남은 ms (허용 가능하면 0) */
  retryAfterMs(key: string, now: number = Date.now()): number {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length < this.max) return 0;
    return Math.max(0, arr[0] + this.windowMs - now);
  }

  /** 1분마다 만료 키 정리 (메모리 누수 방지) */
  private sweep(now: number) {
    if (now - this.lastSweep < 60e3) return;
    this.lastSweep = now;
    for (const [k, arr] of this.hits) {
      const live = arr.filter((t) => now - t < this.windowMs);
      if (live.length) this.hits.set(k, live);
      else this.hits.delete(k);
    }
  }
}

/** 요청 헤더에서 클라이언트 IP 추출. nginx 가 X-Real-IP / X-Forwarded-For 를 붙인다. 없으면 "local". */
export function clientIpFrom(headers: { get(name: string): string | null }): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return "local";
}

export function isLoopbackIp(ip: string): boolean {
  return ip === "local" || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}
