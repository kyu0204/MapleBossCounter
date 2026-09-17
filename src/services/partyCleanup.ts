import "server-only";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { parties } from "@/lib/db/schema";
import { thisWeekStartKst } from "@/lib/maple/kst";

/**
 * "이번 주만" 파티를 주간 리셋이 지나면 지운다.
 *
 * 목 00:00 KST 크론으로 돌지만, 크론이 꺼진 환경(로컬 개발 등)에서도 파티 화면을
 * 열 때 한 번 더 부른다. 두 번 돌아도 지울 것이 없으면 아무 일도 안 한다.
 *
 * week_start 가 없는 옛 데이터는 건드리지 않는다. 언제 만들었는지 모르는 것을
 * 지울 근거가 없다.
 */
export async function purgeExpiredOneOffParties(now: number = Date.now()): Promise<number> {
  const cutoff = thisWeekStartKst(now);
  const gone = await db
    .delete(parties)
    .where(and(eq(parties.repeats, false), isNotNull(parties.weekStart), lt(parties.weekStart, cutoff)))
    .returning({ id: parties.id });
  return gone.length;
}
