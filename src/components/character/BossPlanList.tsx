import { crystalPrice } from "@/lib/maple/prices";
import { fmtPower } from "@/lib/maple/format";
import { tierOf } from "@/lib/maple/tiers";
import { bossName } from "@/lib/maple/bossMeta";
import { picksTotals, splitByCleared, type MergedPick } from "@/lib/maple/bossPicks";
import { rewardRowsFor } from "@/lib/maple/rewards";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";
import { RewardChip } from "@/components/boss/DropList";
import { BossPartyInput } from "./BossPartyInput";
import { BossSettingsModal, type BossSettingsModalProps } from "./BossSettingsModal";

/**
 * "이번 주 갈 보스" — 고른 보스만 한 줄씩.
 *
 * 전체 보스와 난이도는 여기 없다. 설정 모달에서만 고른다.
 * 줄 생김새는 클리어 여부·출처와 무관하게 같다: 아이콘 / 이름·티어 / 인원 / 수익·확정 보상.
 * 안 간 보스가 먼저 오고 이미 간 보스는 아래에 흐리게 붙는다.
 */
export function BossPlanList({
  picks,
  cleared,
  cap,
  priceDate,
  hasSnapshot,
  settings,
  extraCleared,
}: {
  picks: MergedPick[];
  /** 이번 주 실제 클리어한 키 ("보스 난이도") */
  cleared: string[];
  cap: number;
  priceDate: string;
  hasSnapshot: boolean;
  settings: BossSettingsModalProps;
  /** 고르지 않았는데 클리어한 주간 보스 (참고용) */
  extraCleared: { key: string; boss: string; diff: string; value: number }[];
}) {
  const { remaining, done } = splitByCleared(picks, cleared);
  const left = picksTotals(remaining, priceDate);
  const all = picksTotals(picks, priceDate);
  const over = picks.length > cap;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-semibold">이번 주 갈 보스</h2>
        {picks.length > 0 && (
          <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
            남은 {remaining.length}개 / 고른 {picks.length}개{done.length > 0 && ` · ${done.length}개 완료`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <BossSettingsModal {...settings} />
        </div>
      </div>

      {picks.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs text-zinc-500">남은 수익</span>
            <b className="text-lg tabular-nums text-orange-600 dark:text-orange-400">{fmtPower(left.value)}</b>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs text-zinc-500">고른 전체</span>
            <span className="tabular-nums">{fmtPower(all.value)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs text-zinc-500">정가 합</span>
            <span className="tabular-nums text-zinc-500">{fmtPower(all.gross)}</span>
          </span>
        </div>
      )}

      {over && <div className="text-xs text-red-600">주간 입장 한도({cap})를 넘게 골랐습니다. 플래너에서는 실수령 상위 {cap}개만 배분됩니다.</div>}

      {picks.length === 0 ? (
        <div className="text-sm text-zinc-500">아직 고른 보스가 없습니다. &apos;보스 설정&apos;을 눌러 이번 주에 갈 보스를 고르세요.</div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[...remaining, ...done].map((p) => {
            const isDone = cleared.includes(p.key);
            const price = crystalPrice(p.boss, p.diff, priceDate);
            const value = price == null ? null : Math.floor(price / Math.max(1, p.party));
            const fixed = rewardRowsFor(p.boss, p.diff, priceDate).fixed;
            return (
              <li key={p.key} className={`flex items-center gap-3 py-2 ${isDone ? "opacity-50" : ""}`}>
                <span className="w-5 shrink-0 text-center" title={isDone ? "이번 주 클리어 완료" : "아직 안 감"}>
                  {isDone ? "✅" : "⬜"}
                </span>
                <BossIcon boss={p.boss} diff={p.diff} size={64} showDiff={false} className={isDone ? "grayscale" : ""} />
                <span className="flex flex-col gap-0.5 min-w-0 w-40 sm:w-48 shrink-0 leading-tight">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <DifficultyBadge diff={p.diff} size="xs" solid />
                    <span className="font-medium truncate" title={bossName(p.boss)}>
                      {bossName(p.boss)}
                    </span>
                    {p.source === "party" && (
                      <span className="text-xs shrink-0" title="파티 등록에서 자동으로 들어온 보스">
                        🔒
                      </span>
                    )}
                  </span>
                  <TierStars tier={tierOf(p.boss, p.diff)} size={11} />
                </span>
                <BossPartyInput ocid={settings.ocid} bossKey={p.key} party={p.party} fromParty={p.source === "party"} />
                <span className="flex flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 min-w-0">
                  {fixed.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1 justify-end" title="잡으면 무조건 주는 보상">
                      {fixed.map((r) => (
                        <RewardChip key={r.name} reward={r} />
                      ))}
                    </span>
                  )}
                  <span className="text-right whitespace-nowrap w-28 shrink-0">
                    {value == null ? (
                      <span className="text-xs text-zinc-400">가격 미등록</span>
                    ) : (
                      <>
                        <b className="tabular-nums">{fmtPower(value)}</b>
                        {p.party > 1 && price != null && <span className="block text-[11px] text-zinc-500 tabular-nums">{fmtPower(price)} ÷ {p.party}</span>}
                      </>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {extraCleared.length > 0 && (
        <div className="text-xs text-zinc-500">
          고르지 않았는데 클리어한 보스 {extraCleared.length}개 (수익 {fmtPower(extraCleared.reduce((s, x) => s + x.value, 0))}):{" "}
          {extraCleared.map((x) => `${x.boss} ${x.diff}`).join(", ")}
        </div>
      )}

      {picks.length > 0 && (
        <div className="text-[11px] text-zinc-400">
          {hasSnapshot
            ? "클리어한 보스는 흐리게 내려갑니다. 판정은 인게임 스케줄러의 실제 클리어 기준이라, 잡고 나면 새로고침을 눌러야 반영됩니다. 인원은 바꾸는 즉시 저장되고 플래너에도 반영됩니다."
            : "스케줄러 데이터가 없어 클리어 여부를 알 수 없습니다. 새로고침을 눌러 조회하면 간 보스가 아래로 내려갑니다."}
        </div>
      )}
    </div>
  );
}
