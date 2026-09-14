import PQueue from "p-queue";

/**
 * 크레덴셜 id 별 호출 큐. 초당 ratePerSec-1 건 (여유 1건).
 * 잡의 대량 호출과 사용자 요청이 같은 큐를 타므로 키 하나로 한도를 넘지 않는다.
 */
const queues = new Map<string, PQueue>();

export function queueFor(credId: string, ratePerSec: number): PQueue {
  let q = queues.get(credId);
  if (!q) {
    q = new PQueue({ interval: 1000, intervalCap: Math.max(1, ratePerSec - 1), carryoverIntervalCount: true });
    queues.set(credId, q);
  }
  return q;
}

export function queueStats() {
  return [...queues.entries()].map(([id, q]) => ({ id, size: q.size, pending: q.pending }));
}
