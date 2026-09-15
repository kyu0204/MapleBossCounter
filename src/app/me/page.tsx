import Link from "next/link";
import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { listOwnedCharacters } from "@/services/characterSync";
import { latestSnapshot, parsed } from "@/services/snapshotService";
import { estimateRevenue } from "@/lib/maple/scheduler";
import { kstDateStr } from "@/lib/maple/kst";
import { CharacterCard } from "@/components/character/CharacterCard";
import { CharacterSettingsModal } from "@/components/character/CharacterSettingsModal";
import { ResyncButton } from "@/components/character/ResyncButton";
import { partySizeLookup } from "@/services/partyLink";

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
  const partyOf = partySizeLookup(userId);

  const cards = visible.map((c) => {
    const snap = parsed(latestSnapshot(c.id));
    const rev = snap ? estimateRevenue(snap.bosses.filter((b) => b.cycle === "bossWeekly"), priceDate, (b, d) => partyOf(c.id, b, d)) : null;
    return { c, snap, rev };
  });

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
