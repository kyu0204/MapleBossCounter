import Link from "next/link";
import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { listOwnedCharacters } from "@/services/characterSync";
import { latestSnapshot, parsed } from "@/services/snapshotService";
import { kstDateStr } from "@/lib/maple/kst";
import { loadPlanConfig } from "@/services/planInput";
import { partyPicksByCharacter } from "@/services/partyLink";
import { normalizeBossList, bossKey } from "@/lib/maple/bossKey";
import { mergePicks, toPickList, splitByCleared, picksTotals } from "@/lib/maple/bossPicks";
import { aggregateFixedRewards, isAccountWideReward } from "@/lib/maple/rewards";
import { crystalPrice } from "@/lib/maple/prices";
import { partySizeLookup } from "@/services/partyLink";
import { fmtPower } from "@/lib/maple/format";
import { RewardTotalChip } from "@/components/boss/RewardTotalChip";
import { CharacterCard } from "@/components/character/CharacterCard";
import { CharacterSettingsModal } from "@/components/character/CharacterSettingsModal";
import { ResyncButton } from "@/components/character/ResyncButton";
import { SchedulerAutoRefresh } from "@/components/character/SchedulerAutoRefresh";
import { DASHBOARD_MIN_LEVEL } from "@/lib/dashboard";

export const metadata = { title: "내 캐릭터" };

export { DASHBOARD_MIN_LEVEL } from "@/lib/dashboard";

/**
 * 월 환산에 쓰는 주 수. 실제 한 달은 약 4.35주지만 곱셈이 눈에 보이도록 4주로 둔다.
 * 실적이 아니라 단순 환산치라서 정확도보다 계산이 뻔한 편이 낫다.
 */
const WEEKS_PER_MONTH = 4;

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const userId = await requireUserId();
  const key = await nexonKeyStatus(userId);
  if (!key) {
    return (
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">내 캐릭터</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">넥슨 API 키를 먼저 등록해야 합니다.</p>
        <Link href="/settings/nexon-key" className="btn-primary w-fit">
          키 등록하기
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const showAll = sp.all === "1";
  const all = await listOwnedCharacters(userId, true);
  const visible = showAll ? all : all.filter((c) => !c.hidden && (c.level ?? 0) >= DASHBOARD_MIN_LEVEL);
  const hiddenCount = all.length - visible.length;
  const priceDate = kstDateStr();

  /**
   * 카드의 수익은 캐릭터 상세와 같은 기준으로 센다: 내가 고른 보스 + 내가 정한 인원.
   * 예전에는 스케줄러가 준 클리어 전부를 파티 등록 인원으로만 나눠서, 목록에서 손으로
   * 정한 인원이 무시되고 상세 화면과 숫자가 어긋났다.
   */
  const partyPicksAll = await partyPicksByCharacter(userId);
  // 월드 설정은 캐릭터마다 같은 것을 여러 번 읽으므로 한 번씩만 받아 둔다.
  const worlds = [...new Set(visible.map((c) => c.world).filter((w): w is string => !!w))];
  const cfgCache = new Map(await Promise.all(worlds.map(async (w) => [w, await loadPlanConfig(userId, w)] as const)));

  const cards = await Promise.all(visible.map(async (c) => {
    const snap = parsed(await latestSnapshot(c.id));
    const world = c.world ?? "";
    const cfg = world ? cfgCache.get(world) ?? null : null;
    const defaultParty = cfg?.default_party ?? 1;
    const saved = Object.fromEntries(normalizeBossList(cfg?.characters?.[c.ocid]?.bosses).map((b) => [b.key, b.party ?? defaultParty]));
    const picks = toPickList(mergePicks(saved, partyPicksAll.get(c.id) ?? {}));
    const cleared = (snap?.bosses ?? []).filter((b) => b.cycle === "bossWeekly" && b.completed).map((b) => bossKey(b.boss, b.diff));
    const { remaining, done } = splitByCleared(picks, cleared);
    // 카드에는 총 수익만 낸다. 진행 상황은 "주간 보스 n/12" 줄이 이미 보여 주고,
    // 지금까지 번 것은 맨 위 합계와 캐릭터 상세에 있다.
    const rev = picks.length ? picksTotals(picks, priceDate).value : null;
    const earned = picks.length ? picksTotals(done, priceDate).value : 0;
    return { c, snap, rev, earned, remainingCount: remaining.length, picks };
  }));

  // 표시 중인 캐릭터 전체 합계
  const grand = cards.reduce(
    (s, x) => ({ total: s.total + (x.rev ?? 0), earned: s.earned + x.earned, remaining: s.remaining + x.remainingCount }),
    { total: 0, earned: 0, remaining: 0 },
  );
  /**
   * 확정 보상도 캐릭터를 가로질러 합친다. 조각·큐브는 보스마다 인원으로 나눈 뒤 더해진다.
   * 계정에서 같이 쓰는 것(주문의 흔적·큐브)만 남긴다. 캐릭터에 묶인 재료는 상세에서 본다.
   */
  const grandRewards = aggregateFixedRewards(cards.flatMap((x) => x.picks), priceDate).filter((r) => isAccountWideReward(r.name));

  /**
   * 월간 보스(검은 마법사)는 고르는 대상이 아니라 스케줄러에 뜨는 그대로 센다.
   * 인게임 스케줄러에 등록해 둔 행만 잡고, 한 캐릭터에 여러 난이도가 떠 있으면
   * 비싼 쪽 하나만 센다 — 한 달에 한 번뿐이라 둘 다 돌 수는 없다.
   * 인원은 파티 등록 기준(없으면 1인)이다. 단순 계산이라 그 이상은 따지지 않는다.
   */
  const partyOf = await partySizeLookup(userId);
  const monthlyPicks = cards.flatMap(({ c, snap }) => {
    const best = (snap?.bosses ?? [])
      .filter((b) => b.cycle === "bossMonthly" && b.registered)
      .map((b) => ({ boss: b.boss, diff: b.diff, party: partyOf(c.id, b.boss, b.diff), price: crystalPrice(b.boss, b.diff, priceDate) ?? 0 }))
      .sort((a, b) => b.price - a.price)[0];
    return best ? [best] : [];
  });
  const monthlyBossValue = monthlyPicks.reduce((s, p) => s + Math.floor(p.price / Math.max(1, p.party)), 0);

  // 월 환산 = 주간 × 주 수 + 월간 보스 1회. 인원 분배는 이미 각 단계에서 끝났으므로 여기서는 더하기만.
  const monthlyValue = grand.total * WEEKS_PER_MONTH + monthlyBossValue;
  const monthlyRewards = (() => {
    const acc = new Map(grandRewards.map((r) => [r.name, { ...r, total: r.total * WEEKS_PER_MONTH }]));
    for (const r of aggregateFixedRewards(monthlyPicks, priceDate)) {
      if (!isAccountWideReward(r.name)) continue;
      const hit = acc.get(r.name);
      if (hit) hit.total += r.total;
      else acc.set(r.name, { ...r });
    }
    return [...acc.values()].sort((a, b) => b.total - a.total);
  })();

  const byWorld = new Map<string, typeof cards>();
  for (const x of cards) {
    const w = x.c.world ?? "?";
    if (!byWorld.has(w)) byWorld.set(w, []);
    byWorld.get(w)!.push(x);
  }
  for (const list of byWorld.values()) list.sort((a, b) => (b.c.level ?? 0) - (a.c.level ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">내 캐릭터</h1>
        <span className="text-sm text-zinc-500">
          {visible.length}개 표시{hiddenCount > 0 && ` · ${hiddenCount}개 숨김`}
        </span>
        {showAll ? (
          <Link href="/me" className="text-sm underline text-zinc-500">
            Lv.{DASHBOARD_MIN_LEVEL} 이상만 보기
          </Link>
        ) : (
          hiddenCount > 0 && (
            <Link href="/me?all=1" className="text-sm underline text-zinc-500">
              전체 보기 (Lv.{DASHBOARD_MIN_LEVEL} 미만·숨김 포함)
            </Link>
          )
        )}
        <div className="ml-auto flex items-center gap-2">
          <SchedulerAutoRefresh />
          <CharacterSettingsModal
            characters={all.map((c) => ({ ocid: c.ocid, name: c.name, world: c.world, cls: c.cls, level: c.level, imageUrl: c.imageUrl, hidden: c.hidden }))}
            minLevel={DASHBOARD_MIN_LEVEL}
          />
          <ResyncButton />
        </div>
      </div>
      {grand.total > 0 && (
        <div className="card space-y-3">
          {/* 맨 위는 월 환산. 실적이 아니라 곱셈 + 월간 보스 1회다. */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-xs text-zinc-500">월 환산 수익</span>
            <b className="text-2xl tabular-nums text-orange-600 dark:text-orange-400">{fmtPower(monthlyValue)}</b>
            <span className="text-xs text-zinc-500">
              주간 {fmtPower(grand.total)} × {WEEKS_PER_MONTH}주
              {monthlyBossValue > 0 && ` + 월간 보스 ${fmtPower(monthlyBossValue)}`}
            </span>
            <span className="text-[11px] text-zinc-400 ml-auto">단순 환산치입니다</span>
          </div>
          {monthlyRewards.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-xs text-zinc-500 shrink-0">확정 보상</span>
              <span className="flex flex-wrap items-center gap-1">
                {monthlyRewards.map((it) => (
                  <RewardTotalChip key={it.name} item={it} />
                ))}
              </span>
            </div>
          )}
          {monthlyPicks.length > 0 && (
            <div className="text-[11px] text-zinc-400">
              월간 보스는 인게임 스케줄러에 등록해 둔 것만 셉니다 (캐릭터 {monthlyPicks.length}개:{" "}
              {[...new Set(monthlyPicks.map((p) => `${p.boss} ${p.diff}`))].join(", ")}).
            </div>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <div className="card text-sm text-zinc-500">
          표시할 캐릭터가 없습니다. Lv.{DASHBOARD_MIN_LEVEL} 이상 캐릭터가 없거나 모두 숨김 상태입니다.{" "}
          <Link href="/me?all=1" className="underline">
            전체 보기
          </Link>
        </div>
      )}
      {/* 캐릭터 카드는 2열, 이번 주 요약은 오른쪽에 붙여 둔다 */}
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem] items-start">
        <div className="space-y-6 min-w-0">
          {[...byWorld.entries()].sort((a, b) => b[1].length - a[1].length).map(([world, list]) => (
            <section key={world} className="space-y-2">
              <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">
                {world} <span className="text-xs text-zinc-500">{list.length}</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map(({ c, snap, rev }) => (
                  <CharacterCard key={c.ocid} character={c} snapshot={snap} revenue={rev} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {grand.total > 0 && (
          <div className="card space-y-3">
            <h2 className="font-semibold">이번 주</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-500">총 수익</span>
                <b className="text-lg tabular-nums">{fmtPower(grand.total)}</b>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-500">지금까지</span>
                <span className="tabular-nums">{fmtPower(grand.earned)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-500">남은 것{grand.remaining > 0 && ` · 보스 ${grand.remaining}개`}</span>
                <span className="tabular-nums">{fmtPower(grand.total - grand.earned)}</span>
              </div>
            </div>
            {grandRewards.length > 0 && (
              <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <div className="text-xs text-zinc-500">확정 보상</div>
                <div className="flex flex-wrap items-center gap-1">
                  {grandRewards.map((it) => (
                    <RewardTotalChip key={it.name} item={it} />
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-zinc-400">
              표시 중인 캐릭터 기준 · 고른 보스와 설정한 인원으로 계산. 큐브는 인원으로 나눈 뒤 합한 값. 계정에서 같이 쓰는 주문의 흔적·큐브만 셉니다 (솔 에르다·조각류 등 캐릭터별 재료는 상세에서).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
