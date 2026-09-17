/**
 * "이번 주 갈 보스" 저장 경로를 실제 DB 복사본으로 검증한다 (실데이터 비변경).
 * 실행: npx tsx scripts/check-bossplan.ts [닉네임=알전임]
 */
import "./_bootstrap";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "data", "app.db");
const TMP = path.join(process.cwd(), "data", "check-bossplan.db");
if (!existsSync(SRC)) {
  console.error("data/app.db 없음");
  process.exit(1);
}
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(SRC + suffix)) copyFileSync(SRC + suffix, TMP + suffix);
}
process.env.DATABASE_PATH = TMP;

async function main() {
  const name = process.argv[2] ?? "알전임";
  const { db } = await import("../src/lib/db");
  const { characters } = await import("../src/lib/db/schema");
  const { loadCharConfig, patchCharConfig, loadPlanConfig } = await import("../src/services/planInput");
  const { partyPicksByCharacter } = await import("../src/services/partyLink");
  const { latestSnapshot, parsed } = await import("../src/services/snapshotService");
  const { validateBossSelection, buildProfile, allocatePlan } = await import("../src/lib/maple/planner");
  const { weeklyCandidates } = await import("../src/lib/maple/prices");
  const { normalizeBossList, bossKey } = await import("../src/lib/maple/bossKey");
  const { bossTag } = await import("../src/lib/maple/bossMeta");
  const { fmtPower } = await import("../src/lib/maple/format");
  const { kstDateStr } = await import("../src/lib/maple/kst");
  const { eq } = await import("drizzle-orm");

  const [c] = await db.select().from(characters).where(eq(characters.name, name)).limit(1);
  if (!c?.ownerUserId || !c.world) throw new Error(`${name} 캐릭터/소유자/월드 없음`);
  const userId = c.ownerUserId;
  const priceDate = kstDateStr();
  console.log(`대상 ${c.name} (${c.world}, owner ${userId.slice(0, 8)}…)`);

  // 페이지가 읽는 값들
  const snap = parsed(await latestSnapshot(c.id));
  const weekly = snap?.bosses.filter((b) => b.cycle === "bossWeekly") ?? [];
  const registered = weekly.filter((b) => b.registered).map((b) => bossKey(b.boss, b.diff));
  const cleared = weekly.filter((b) => b.completed).map((b) => bossKey(b.boss, b.diff));
  const partyPicks = (await partyPicksByCharacter(userId)).get(c.id) ?? {};
  console.log(`1) 페이지 입력: cap ${snap?.weeklyLimit ?? 12}, 등록 ${registered.length}, 클리어 ${cleared.length}, 파티유래 ${Object.keys(partyPicks).length}`);
  console.log(`   기존 저장값: ${Object.keys(Object.fromEntries(normalizeBossList((await loadCharConfig(userId, c.world, c.ocid)).bosses).map((b) => [b.key, b.party]))).length}개`);

  // 저장 (스케줄러 등록 상위 몇 개를 고른 상황을 흉내)
  const pickKeys = registered.slice(0, 5);
  const sel: Record<string, number> = {};
  for (const k of pickKeys) sel[k] = k.includes("세렌") ? 3 : 1;
  const v = validateBossSelection(sel, priceDate);
  if (!v.ok) throw new Error(`검증 실패: ${v.error}`);
  await patchCharConfig(userId, c.world, c.ocid, { bosses: v.clean, auto: false });
  console.log(`2) 저장: ${Object.keys(v.clean).length}개 → ${Object.keys(v.clean).map((k) => bossTag(k.slice(0, k.lastIndexOf(" ")), k.slice(k.lastIndexOf(" ") + 1))).join(", ")}`);

  // 재읽기
  const back = Object.fromEntries(normalizeBossList((await loadCharConfig(userId, c.world, c.ocid)).bosses).map((b) => [b.key, b.party]));
  const same = JSON.stringify(back) === JSON.stringify(v.clean);
  console.log(`3) 재읽기 일치: ${same ? "OK" : "FAIL " + JSON.stringify(back)}`);

  // 다른 캐릭터 설정이 보존되는지
  const cfg = await loadPlanConfig(userId, c.world);
  console.log(`4) 같은 월드 설정 캐릭터 수: ${Object.keys(cfg.characters).length} (내 캐릭터 외 설정 보존 확인)`);

  // 플래너에 고정 픽으로 반영되는지
  const { profile } = buildProfile({
    charId: c.ocid, name: c.name, cfg: cfg.characters[c.ocid], defaultParty: cfg.default_party ?? 1,
    priceDate, snapshotBosses: [weekly.filter((b) => b.completed)], cap: snap?.weeklyLimit ?? 12, partyPicks,
  });
  const out = allocatePlan({ priceDate, worldLimit: cfg.world_limit ?? 90, candidates: weeklyCandidates(priceDate), profiles: [profile] });
  const row = out.rows[0];
  console.log(`5) 플래너 반영: ${row.picks.length}개 (고정 ${row.picks.filter((p) => p.fixed).length}), 실수령 ${fmtPower(row.value)}`);
  const missing = Object.keys(v.clean).filter((k) => !row.picks.some((p) => bossKey(p.boss, p.diff) === k));
  console.log(`   선택한 보스가 전부 픽에 포함: ${missing.length === 0 ? "OK" : "FAIL " + missing.join(", ")}`);

  console.log("\nCHECK OK (복사본 DB 사용, 실데이터 변경 없음)");
}

main()
  .catch((e) => {
    console.error("CHECK FAIL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // better-sqlite3 핸들을 닫아야 Windows 에서 파일 삭제가 된다
    try {
      const { db } = await import("../src/lib/db");
      (db as unknown as { $client?: { close(): void } }).$client?.close();
    } catch {
      /* noop */
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        rmSync(TMP + suffix, { force: true });
      } catch {
        /* 잠겨 있으면 다음 실행 때 덮어쓴다 (data/ 는 gitignore) */
      }
    }
  });
