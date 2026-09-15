import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { ownedCharacterByOcid } from "@/services/characterSync";
import { latestSnapshot, parsed, snapshotOn } from "@/services/snapshotService";
import { powerHistory } from "@/services/characterRefresh";
import { partySizeLookup } from "@/services/partyLink";
import { estimateRevenue } from "@/lib/maple/scheduler";
import { kstDateStr, lastWednesdayKst } from "@/lib/maple/kst";
import { fmtPower } from "@/lib/maple/format";
import { RefreshButton } from "@/components/character/RefreshButton";
import { BossClearTable } from "@/components/character/BossClearTable";
import { RevenueSummary } from "@/components/character/RevenueSummary";
import { ContentsList } from "@/components/character/ContentsList";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";
import { RemainingBossList, PickedBossList } from "@/components/character/BossPlanList";
import { loadCharConfig, loadPlanConfig } from "@/services/planInput";
import { partyPicksByCharacter } from "@/services/partyLink";
import { normalizeBossList, bossKey } from "@/lib/maple/bossKey";
import { mergePicks, toPickList } from "@/lib/maple/bossPicks";
import { crystalPrice } from "@/lib/maple/prices";

export default async function CharacterPage({ params, searchParams }: PageProps<"/me/characters/[ocid]">) {
  const userId = await requireUserId();
  const { ocid } = await params;
  const sp = await searchParams;
  const c = ownedCharacterByOcid(userId, ocid);
  if (!c) notFound();

  const view = sp.view === "lastweek" ? "lastweek" : "current";
  const latest = parsed(latestSnapshot(c.id));
  const snap = view === "lastweek" ? parsed(snapshotOn(c.id, lastWednesdayKst())) : latest;
  const priceDate = view === "lastweek" ? lastWednesdayKst() : kstDateStr();
  const partyOf = partySizeLookup(userId);
  const revenue = snap ? estimateRevenue(snap.bosses, priceDate, (b, d) => partyOf(c.id, b, d)) : null;
  const history = powerHistory(c.id, 30);
  const wearingBest = c.bestSetupHash != null && c.curSetupHashes?.equipped === c.bestSetupHash;

  // 갈 보스 목록: 플래너와 같은 저장소(plan_configs)를 쓴다. 두 화면이 항상 같은 목록을 본다.
  const world = c.world ?? "";
  const charCfg = world ? loadCharConfig(userId, world, ocid) : {};
  const planDefaultParty = world ? loadPlanConfig(userId, world).default_party ?? 1 : 1;
  const savedBosses = Object.fromEntries(normalizeBossList(charCfg.bosses).map((b) => [b.key, b.party ?? planDefaultParty]));
  const partyPicks = partyPicksByCharacter(userId).get(c.id) ?? {};
  const allPicks = toPickList(mergePicks(savedBosses, partyPicks));
  // 클리어·등록 판정은 항상 이번 주 최신 스냅샷 기준이다 (지난주 보기에서도 마찬가지)
  const weeklyRows = latest?.bosses.filter((b) => b.cycle === "bossWeekly") ?? [];
  const clearedKeys = weeklyRows.filter((b) => b.completed).map((b) => bossKey(b.boss, b.diff));
  const registeredKeys = weeklyRows.filter((b) => b.registered).map((b) => bossKey(b.boss, b.diff));
  const cap = latest?.weeklyLimit ?? 12;
  // 고르지 않았는데 클리어한 주간 보스 — 수익에는 잡히므로 참고로 알려 준다
  const pickedKeys = new Set(allPicks.map((p) => p.key));
  const extraCleared = weeklyRows
    .filter((b) => b.completed && !pickedKeys.has(bossKey(b.boss, b.diff)))
    .map((b) => {
      const price = crystalPrice(b.boss, b.diff, priceDate);
      const party = partyOf(c.id, b.boss, b.diff);
      return { key: bossKey(b.boss, b.diff), boss: b.boss, diff: b.diff, value: price == null ? 0 : Math.floor(price / party) };
    });

  // 스케줄러 데이터가 없어도 고르기는 할 수 있어야 하므로 양쪽 분기에서 같은 것을 쓴다.
  const pickedBosses =
    view === "current" && world ? (
      <PickedBossList
        picks={allPicks}
        cleared={clearedKeys}
        cap={cap}
        priceDate={priceDate}
        extraCleared={extraCleared}
        settings={{ ocid, cap, defaultParty: planDefaultParty, initial: savedBosses, partyPicks, registered: registeredKeys, priceDate }}
      />
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <CharacterAvatar src={c.imageUrl} alt={c.name} size={144} />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            {c.name} <span className="text-base font-normal text-zinc-500">{c.world} · {c.cls} · Lv.{c.level}</span>
          </h1>
          <div className="text-sm">
            대표 전투력 <b>{fmtPower(c.bestPower)}</b>
            {c.bestPowerAt && <span className="text-zinc-500"> ({c.bestPowerAt.slice(0, 10)} 기준)</span>}
            <span className="ml-3">현재 {fmtPower(c.curPower)}</span>
            {!wearingBest && c.curPower != null && <span className="ml-1 badge bg-amber-100 text-amber-800">대표값과 다른 세팅 착용 중</span>}
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton ocid={c.ocid} label="전투력·스케줄러 새로고침" />
            <a className="text-xs underline text-zinc-500" href={`https://maplescouter.com/ko/result?name=${encodeURIComponent(c.name)}`} target="_blank" rel="noreferrer">
              maplescouter
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Link href={`/me/characters/${ocid}`} className={`btn-ghost ${view === "current" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
          이번 주
        </Link>
        <Link href={`/me/characters/${ocid}?view=lastweek`} className={`btn-ghost ${view === "lastweek" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
          지난주 ({lastWednesdayKst()})
        </Link>
        {snap?.date && <span className="text-zinc-500">스냅샷 기준일 {snap.date.slice(0, 10)}</span>}
      </div>

      {view === "current" &&
        (world ? (
          <RemainingBossList picks={allPicks} cleared={clearedKeys} cap={cap} priceDate={priceDate} hasSnapshot={!!latest} ocid={ocid} />
        ) : (
          <div className="card text-sm text-zinc-600">월드 정보가 없어 보스 설정을 쓸 수 없습니다. 내 캐릭터에서 목록 동기화를 실행하세요.</div>
        ))}

      {!snap ? (
        <>
          <div className="card text-sm text-zinc-600">스케줄러 데이터가 없습니다. 새로고침을 눌러 조회하세요. (지난주는 수요일 밤 자동 스냅샷이 있어야 표시됩니다)</div>
          {pickedBosses}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {pickedBosses}
            {/* 스케줄러가 주는 목록. 주간은 위에서 고른 것만 보여주므로 여기는 일간·월간만. */}
            <BossClearTable
              bosses={snap.bosses}
              priceDate={priceDate}
              partyOf={(b, d) => partyOf(c.id, b, d)}
              weekly={`${snap.weeklyClearCount}/${snap.weeklyLimit}`}
              title={view === "current" ? "일간·월간 보스" : "보스"}
              cycles={view === "current" ? ["bossDaily", "bossMonthly"] : ["bossWeekly", "bossDaily", "bossMonthly"]}
            />
            <ContentsList title="일간 콘텐츠" items={snap.daily} />
            <ContentsList title="주간 콘텐츠" items={snap.weekly} />
          </div>
          <div className="space-y-4">
            {revenue && <RevenueSummary revenue={revenue} priceDate={priceDate} />}
            <div className="card text-sm">
              <h3 className="font-semibold mb-2">전투력 이력</h3>
              {history.length ? (
                <ul className="space-y-0.5 text-xs">
                  {history
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((h) => (
                      <li key={h.id} className="flex justify-between">
                        <span className="text-zinc-500">{h.measuredAt.slice(0, 16).replace("T", " ")}</span>
                        <span>{fmtPower(h.power)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-zinc-500 text-xs">기록 없음</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
