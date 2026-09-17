/**
 * 로컬 개발 시드: dev 로그인 유저(dev:<username>)에 서버 키를 등록하고 캐릭터·스냅샷·파티 예시를 채운다.
 * 실행: npx tsx scripts/seed-dev.ts [username=tester] [minLevel=270]
 * 앱 DB(data/app.db)를 사용한다. 넥슨 API 를 (캐릭터 수 × 4) 회 정도 호출한다.
 */
import "./_bootstrap";

async function main() {
  const username = process.argv[2] ?? "tester";
  const minLevel = Number(process.argv[3] ?? 270);
  const userId = `dev:${username}`;

  const { db } = await import("../src/lib/db");
  const { users, nexonKeys, characters, parties, partyMembers } = await import("../src/lib/db/schema");
  const { encryptSecret } = await import("../src/lib/crypto");
  const { resolveCredential } = await import("../src/lib/nexon/credentials");
  const { syncCharacters, listOwnedCharacters } = await import("../src/services/characterSync");
  const { refreshCharacter } = await import("../src/services/characterRefresh");
  const { fetchAndSaveRealtime, fetchAndSaveDated } = await import("../src/services/snapshotService");
  const { lastWednesdayKst } = await import("../src/lib/maple/kst");
  const { eq, and } = await import("drizzle-orm");

  const serverKey = process.env.NEXON_SERVER_API_KEY;
  if (!serverKey) throw new Error("NEXON_SERVER_API_KEY 없음");

  await db.insert(users).values({ id: userId, name: username }).onConflictDoNothing();
  const now = new Date().toISOString();
  await db
    .insert(nexonKeys)
    .values({ userId, encKey: encryptSecret(serverKey, userId), keyHint: serverKey.slice(-4), status: "active", accountIds: [], lastOkAt: now })
    .onConflictDoUpdate({ target: nexonKeys.userId, set: { encKey: encryptSecret(serverKey, userId), status: "active", updatedAt: now } });

  const cred = await resolveCredential({ userId, scope: "account" });
  const sync = await syncCharacters(userId, cred, true);
  console.log(`동기화 ${sync.total}개`);

  const targets = (await listOwnedCharacters(userId)).filter((c) => (c.level ?? 0) >= minLevel);
  console.log(`대상 ${targets.length}명 (Lv.${minLevel}+): ${targets.map((c) => c.name).join(", ")}`);
  const wed = lastWednesdayKst();
  for (const c of targets) {
    const r = await refreshCharacter(c, cred, true);
    const s = await fetchAndSaveRealtime(c.id, c.ocid, cred, true);
    const d = await fetchAndSaveDated(c.id, c.ocid, wed, cred);
    console.log(`  ${c.name}: 전투력 ${r.power} / 보스 ${s?.weeklyClearCount ?? "-"} / 지난주(${wed}) ${d ? d.weeklyClearCount : "없음"}`);
  }

  // 예시 파티: 하드 세렌 3인 (존재하는 캐릭터만)
  const names = ["알전임", "다이아태훈", "호감토끼"].filter((n) => targets.some((c) => c.name === n));
  if (names.length >= 2) {
    const [exists] = await db.select().from(parties).where(and(eq(parties.ownerUserId, userId), eq(parties.boss, "선택받은 세렌"))).limit(1);
    if (!exists) {
      const [p] = await db.insert(parties).values({ ownerUserId: userId, name: "시드 예시 파티", boss: "선택받은 세렌", difficulty: "hard", scheduleNote: "목 21:00" }).returning();
      for (const [i, n] of names.entries()) {
        const [ch] = await db.select({ id: characters.id }).from(characters).where(eq(characters.name, n)).limit(1);
        await db.insert(partyMembers).values({ partyId: p.id, nickname: n, characterId: ch?.id ?? null, isLeader: i === 0, sortOrder: i });
      }
      console.log(`파티 생성: 하드 세렌 ${names.length}인격 (${names.join(", ")})`);
    }
  }
  console.log("SEED OK");
}

main().catch((e) => {
  console.error("SEED FAIL:", e);
  process.exit(1);
});
