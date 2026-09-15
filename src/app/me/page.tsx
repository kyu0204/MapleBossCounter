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
import { fmtPower } from "@/lib/maple/format";
import { CharacterCard } from "@/components/character/CharacterCard";
import { CharacterSettingsModal } from "@/components/character/CharacterSettingsModal";
import { ResyncButton } from "@/components/character/ResyncButton";

export const metadata = { title: "내 캐릭터" };

/** 이 레벨 미만 캐릭터는 기본 숨김 (?all=1 로 전체 보기). 수동 숨김(hidden)과는 별개. */
export const DASHBOARD_MIN_LEVEL = Number(process.env.DASHBOARD_MIN_LEVEL ?? 260);

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const userId = await requireUserId();
  const key = nexonKeyStatus(userId);
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
  const all = listOwnedCharacters(userId, true);
  const visible = showAll ? all : all.filter((c) => !c.hidden && (c.level ?? 0) >= DASHBOARD_MIN_LEVEL);
  const hiddenCount = all.length - visible.length;
  const priceDate = kstDateStr();

  /**
   * 카드의 수익은 캐릭터 상세와 같은 기준으로 센다: 내가 고른 보스 + 내가 정한 인원.
   * 예전에는 스케줄러가 준 클리어 전부를 파티 등록 인원으로만 나눠서, 목록에서 손으로
   * 정한 인원이 무시되고 상세 화면과 숫자가 어긋났다.
   */
  const partyPicksAll = partyPicksByCharacter(userId);
  const cfgCache = new Map<string, ReturnType<typeof loadPlanConfig>>();
  const cfgOf = (world: string) => {
    if (!cfgCache.has(world)) cfgCache.set(world, loadPlanConfig(userId, world));
    return cfgCache.get(world)!;
  };

  const cards = visible.map((c) => {
    const snap = parsed(latestSnapshot(c.id));
    const world = c.world ?? "";
    const cfg = world ? cfgOf(world) : null;
    const defaultParty = cfg?.default_party ?? 1;
    const saved = Object.fromEntries(normalizeBossList(cfg?.characters?.[c.ocid]?.bosses).map((b) => [b.key, b.party ?? defaultParty]));
    const picks = toPickList(mergePicks(saved, partyPicksAll.get(c.id) ?? {}));
    const cleared = (snap?.bosses ?? []).filter((b) => b.cycle === "bossWeekly" && b.completed).map((b) => bossKey(b.boss, b.diff));
    const { remaining, done } = splitByCleared(picks, cleared);
    // 카드에는 총 수익만 낸다. 진행 상황은 "주간 보스 n/12" 줄이 이미 보여 주고,
    // 지금까지 번 것은 맨 위 합계와 캐릭터 상세에 있다.
    const rev = picks.length ? picksTotals(picks, priceDate).value : null;
    const earned = picks.length ? picksTotals(done, priceDate).value : 0;
    return { c, snap, rev, earned, remainingCount: remaining.length };
  });

  // 표시 중인 캐릭터 전체 합계
  const grand = cards.reduce(
    (s, x) => ({ total: s.total + (x.rev ?? 0), earned: s.earned + x.earned, remaining: s.remaining + x.remainingCount }),
    { total: 0, earned: 0, remaining: 0 },
  );

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
          <CharacterSettingsModal
            characters={all.map((c) => ({ ocid: c.ocid, name: c.name, world: c.world, cls: c.cls, level: c.level, imageUrl: c.imageUrl, hidden: c.hidden }))}
            minLevel={DASHBOARD_MIN_LEVEL}
          />
          <ResyncButton />
        </div>
      </div>
      {grand.total > 0 && (
        <div className="card flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">이번 주 총 수익</span>
            <b className="text-2xl tabular-nums text-orange-600 dark:text-orange-400">{fmtPower(grand.total)}</b>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">지금까지</span>
            <span className="text-lg tabular-nums">{fmtPower(grand.earned)}</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">남은 것</span>
            <span className="text-lg tabular-nums">{fmtPower(grand.total - grand.earned)}</span>
            {grand.remaining > 0 && <span className="text-xs text-zinc-500">보스 {grand.remaining}개</span>}
          </span>
          <span className="text-[11px] text-zinc-400 ml-auto">표시 중인 캐릭터 기준 · 고른 보스와 설정한 인원으로 계산</span>
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
      {[...byWorld.entries()].sort((a, b) => b[1].length - a[1].length).map(([world, list]) => (
        <section key={world} className="space-y-2">
          <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">
            {world} <span className="text-xs text-zinc-500">{list.length}</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map(({ c, snap, rev }) => (
              <CharacterCard key={c.ocid} character={c} snapshot={snap} revenue={rev} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
