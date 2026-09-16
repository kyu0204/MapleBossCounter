import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { resolveCredential } from "@/lib/nexon/credentials";
import { getCombatPower, getForces } from "@/lib/nexon/endpoints";

/**
 * 남의 캐릭터도 전투력·포스는 채울 수 있다.
 *
 * 스케줄러(클리어 여부)는 키 주인의 계정 캐릭터만 주지만, 전투력(stat)과 심볼은
 * ocid 만 있으면 누구든 조회된다 — 닉네임으로 만들어 둔 row 도 같다. 그래서 파티
 * 구성원 칸이 "—" 로 비어 있을 이유가 없다.
 *
 * 캐릭터를 만든 경로가 달라서 값이 빈 것뿐이다. 내 캐릭터는 새로고침이 채우지만
 * 파티에 닉네임으로 들어온 캐릭터는 /id 와 /basic 만 받고 끝난다.
 */

/** 이 시간이 지났으면 다시 받는다. 전투력·포스는 자주 바뀌지 않는다. */
export const MEMBER_STATS_STALE_MS = 6 * 3600e3;

/** 한 번에 채울 최대 인원. 파티는 6명이 최대라 넉넉하다. */
const MAX_PER_CALL = 6;

const isStale = (at: string | null) => at == null || Date.now() - Date.parse(at) > MEMBER_STATS_STALE_MS;

/**
 * 전투력·포스가 비었거나 오래된 캐릭터를 공개 API 로 채운다. 채운 수를 돌려준다.
 *
 * curPowerAt 은 건드리지 않는다. 그 값은 "주인이 새로고침한 시각" 이고 새로고침
 * 쿨다운(10분) 판정에 쓰여서, 여기서 덮으면 주인이 새로고침을 눌러도 건너뛴다.
 * 이 경로의 최신 여부는 forceFetchedAt 으로 본다.
 */
export async function fillPublicStats(userId: string | null, characterIds: number[]): Promise<number> {
  if (!characterIds.length) return 0;
  const rows = db
    .select({ id: characters.id, ocid: characters.ocid, curPower: characters.curPower, forceFetchedAt: characters.forceFetchedAt })
    .from(characters)
    .where(inArray(characters.id, characterIds))
    .all()
    .filter((c) => c.curPower == null || isStale(c.forceFetchedAt))
    .slice(0, MAX_PER_CALL);
  if (!rows.length) return 0;

  const cred = await resolveCredential({ userId, scope: "public" });
  const results = await Promise.all(
    rows.map(async (c) => {
      // 한 캐릭터가 실패해도 나머지는 채운다 (탈퇴·개명으로 ocid 가 죽어 있을 수 있다)
      try {
        const [power, forces] = await Promise.all([getCombatPower(cred, c.ocid), getForces(cred, c.ocid)]);
        return { id: c.id, power, forces };
      } catch {
        return null;
      }
    }),
  );

  const now = new Date().toISOString();
  let filled = 0;
  for (const r of results) {
    if (!r || (r.power == null && !r.forces)) continue;
    db.update(characters)
      .set({
        ...(r.power != null ? { curPower: r.power } : {}),
        ...(r.forces ? { arcaneForce: r.forces.arcane, authenticForce: r.forces.authentic } : {}),
        forceFetchedAt: now,
        updatedAt: now,
      })
      .where(eq(characters.id, r.id))
      .run();
    filled++;
  }
  return filled;
}
