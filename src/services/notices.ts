import "server-only";
import { and, desc, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { notices, type Notice } from "@/lib/db/schema";
import { resolveCredential } from "@/lib/nexon/credentials";
import { getEventNotices } from "@/lib/nexon/endpoints";
import { parseEventNotices } from "@/lib/maple/notices";

/** 이 시간 안에 받은 적 있으면 다시 안 받는다 (DB 기준). API 응답 캐시(6h)와 별개로 화면 진입 시 판정. */
export const NOTICE_STALE_MS = 6 * 3600e3;

/**
 * 이벤트 공지를 받아 notices 에 upsert 한다. 공개 엔드포인트라 서버 키로 충분하다.
 * 넥슨은 최근 공지만 주므로 지난 것은 지우지 않는다 — 지난달 캘린더가 비지 않게.
 */
export async function refreshEventNotices(userId: string | null = null, force = false): Promise<number> {
  if (!force) {
    const [latest] = await db.select({ fetchedAt: notices.fetchedAt }).from(notices).where(eq(notices.kind, "event")).orderBy(desc(notices.fetchedAt)).limit(1);
    if (latest && Date.now() - Date.parse(latest.fetchedAt) < NOTICE_STALE_MS) return 0;
  }
  const cred = await resolveCredential({ userId, scope: "public" });
  const list = parseEventNotices(await getEventNotices(cred, force));
  const now = new Date().toISOString();
  for (const e of list) {
    const row = { kind: "event" as const, title: e.title, url: e.url, postedAt: e.postedAt, eventStart: e.eventStart, eventEnd: e.eventEnd, isSunday: e.isSunday, fetchedAt: now };
    await db
      .insert(notices)
      .values({ noticeId: e.noticeId, ...row })
      .onConflictDoUpdate({ target: notices.noticeId, set: row });
  }
  return list.length;
}

/** 기간이 [fromIso, toIso] 와 겹치는 이벤트 (시작·종료 중 하나라도 범위 안, 또는 범위를 감싸는 것) */
export async function listEventsBetween(fromIso: string, toIso: string): Promise<Notice[]> {
  return db
    .select()
    .from(notices)
    .where(
      and(
        eq(notices.kind, "event"),
        isNotNull(notices.eventStart),
        or(
          and(gte(notices.eventStart, fromIso), lte(notices.eventStart, toIso)),
          and(isNotNull(notices.eventEnd), gte(notices.eventEnd, fromIso), lte(notices.eventEnd, toIso)),
          and(lte(notices.eventStart, fromIso), isNotNull(notices.eventEnd), gte(notices.eventEnd, toIso)),
        ),
      ),
    )
    .orderBy(notices.eventStart);
}
