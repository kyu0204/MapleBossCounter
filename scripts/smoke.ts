/**
 * Discord 로그인 없이 서버 파이프라인 검증:
 *   가짜 유저 생성 → 서버 키를 유저 키로 등록(암호화) → 캐릭터 동기화 → 1캐릭 전투력 갱신 → 스케줄러 스냅샷 → 상한 스냅샷 조회.
 * 실행: npx tsx scripts/smoke.ts [닉네임]
 * 별도 DB(data/smoke.db)를 쓰므로 앱 DB 를 건드리지 않는다.
 */
import "./_bootstrap";

// Postgres 로 옮기면서 별도 파일 DB 를 쓸 수 없게 됐다. 앱 DB 를 건드리므로
// 반드시 개발용 DATABASE_URL 로만 돌릴 것.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 없음 (개발용 DB 를 가리키게 하고 실행할 것)");

async function main() {
  const target = process.argv[2] ?? "알전임";
  const { db } = await import("../src/lib/db");
  const { users, nexonKeys, characters } = await import("../src/lib/db/schema");
  const { encryptSecret } = await import("../src/lib/crypto");
  const { resolveCredential } = await import("../src/lib/nexon/credentials");
  const { syncCharacters } = await import("../src/services/characterSync");
  const { refreshCharacter } = await import("../src/services/characterRefresh");
  const { fetchAndSaveRealtime, ceilingSnapshots } = await import("../src/services/snapshotService");
  const { estimateRevenue, highestClearedTier } = await import("../src/lib/maple/scheduler");
  const { fmtPower } = await import("../src/lib/maple/format");
  const { kstDateStr } = await import("../src/lib/maple/kst");
  const { tierLabel } = await import("../src/lib/maple/tiers");
  const { eq } = await import("drizzle-orm");

  const serverKey = process.env.NEXON_SERVER_API_KEY;
  if (!serverKey) throw new Error("NEXON_SERVER_API_KEY 없음");

  const userId = "smoke-user";
  await db.insert(users).values({ id: userId, name: "smoke" }).onConflictDoNothing();
  const now = new Date().toISOString();
  await db
    .insert(nexonKeys)
    .values({ userId, encKey: encryptSecret(serverKey, userId), keyHint: serverKey.slice(-4), status: "active", accountIds: [], lastOkAt: now })
    .onConflictDoUpdate({ target: nexonKeys.userId, set: { encKey: encryptSecret(serverKey, userId), status: "active", updatedAt: now } });
  console.log("1) 키 등록(암호화) OK");

  const cred = await resolveCredential({ userId, scope: "account" });
  const t0 = Date.now();
  const sync = await syncCharacters(userId, cred, true);
  console.log(`2) 캐릭터 동기화: ${sync.total}개 (신규 ${sync.created}, 갱신 ${sync.updated}, 계정 ${sync.accountIds.length}) ${Date.now() - t0}ms`);

  const [ch] = await db.select().from(characters).where(eq(characters.name, target)).limit(1);
  if (!ch) throw new Error(`${target} 캐릭터 없음`);

  const r1 = await refreshCharacter(ch, cred, true);
  console.log(`3) 전투력 갱신: ${target} 현재 ${fmtPower(r1.power)} / 대표 ${fmtPower(r1.character.bestPower)} note=${r1.note} wearingBest=${r1.wearingBest}`);
  const r2 = await refreshCharacter(r1.character, cred, false);
  console.log(`   재호출(쿨다운): skipped=${r2.skipped}`);

  const snap = await fetchAndSaveRealtime(ch.id, ch.ocid, cred, true);
  if (!snap) throw new Error("스케줄러 스냅샷 없음");
  const rev = estimateRevenue(snap.bosses, kstDateStr());
  const top = highestClearedTier(snap.bosses);
  console.log(`4) 스케줄러: 보스 ${snap.weeklyClearCount}/${snap.weeklyLimit}, 행 ${snap.bosses.length}, 주간 결정 ${rev.byCycle.bossWeekly.count}개 ${fmtPower(rev.byCycle.bossWeekly.value)}`);
  console.log(`   상한: ${top ? `${top.boss} ${top.diff} (${tierLabel(top.tier)})` : "없음"}`);

  const cs = await ceilingSnapshots(ch.id);
  console.log(`5) 상한 스냅샷 ${cs.length}개: ${cs.map((s) => s.date?.slice(0, 10)).join(", ")}`);

  // 캐시 히트 확인: 같은 basic 호출은 api_cache 에서
  const t1 = Date.now();
  await refreshCharacter(r1.character, cred, true); // force 지만 TTL 캐시 무시 → 실제 호출
  const t2 = Date.now();
  const { getBasic } = await import("../src/lib/nexon/endpoints");
  await getBasic(cred, ch.ocid);
  console.log(`6) 강제 갱신 ${t2 - t1}ms, 캐시 basic ${Date.now() - t2}ms`);
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
