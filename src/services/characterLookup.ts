import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, type Character } from "@/lib/db/schema";
import { resolveCredential } from "@/lib/nexon/credentials";
import { getBasic, getOcid } from "@/lib/nexon/endpoints";
import { SlidingWindowLimiter } from "@/lib/limiter";

/** 닉네임 resolve 리밋: 유저당 분당 10회 (미확인 닉네임의 API 조회만 카운트) */
const resolveLimiter = new SlidingWindowLimiter(10, 60e3);

export interface LookupCharacter {
  id: number;
  world: string | null;
  level: number | null;
  owner: string | null;
}

/**
 * 닉네임 → characters row 확보. DB 에 있으면 그대로(리프로 대체된 row 제외), 없으면 공개 API(/id, /basic)로 조회해 owner NULL 로 생성.
 * 리밋에 걸리거나 조회 실패면 null.
 */
export async function ensureCharacterByName(userId: string | null, nickname: string): Promise<LookupCharacter | null> {
  const existing = db
    .select({ id: characters.id, world: characters.world, level: characters.level, owner: characters.ownerUserId })
    .from(characters)
    .where(and(eq(characters.name, nickname), isNull(characters.supersededBy)))
    .get();
  if (existing) return existing;
  if (!resolveLimiter.allow(userId ?? "anon")) return null;
  try {
    const cred = await resolveCredential({ userId, scope: "public" });
    const ocid = await getOcid(cred, nickname);
    const basic = await getBasic(cred, ocid);
    return db
      .insert(characters)
      .values({ ocid, name: basic.character_name, world: basic.world_name, cls: basic.character_class, level: basic.character_level, imageUrl: basic.character_image, basicFetchedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: characters.ocid, set: { name: basic.character_name, world: basic.world_name, cls: basic.character_class, level: basic.character_level, updatedAt: new Date().toISOString() } })
      .returning({ id: characters.id, world: characters.world, level: characters.level, owner: characters.ownerUserId })
      .get();
  } catch {
    return null;
  }
}

export function characterById(id: number): Character | null {
  return db.select().from(characters).where(eq(characters.id, id)).get() ?? null;
}

/** 공개 조회용: 닉네임으로 현재(대체되지 않은) row. 없으면 null. */
export function characterByName(name: string): Character | null {
  return db.select().from(characters).where(and(eq(characters.name, name), isNull(characters.supersededBy))).get() ?? null;
}
