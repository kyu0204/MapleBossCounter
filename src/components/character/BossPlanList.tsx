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
 * 보스 한 줄. 클리어 여부·출처와 무관하게 생김새가 같다.
 * 아이콘 / 난이도·이름·티어 / 인원 / 확정 보상·실수령.
 */
function BossRow({ pick, ocid, done, priceDate }: { pick: MergedPick; ocid: string; done: boolean; priceDate: string }) {
  const price = crystalPrice(pick.boss, pick.diff, priceDate);
  const value = price == null ? null : Math.floor(price / Math.max(1, pick.party));
  const fixed = rewardRowsFor(pick.boss, pick.diff, priceDate).fixed;
  return (
    <li className={`flex items-center gap-3 py-2 ${done ? "opacity-50" : ""}`}>
      <span className="w-5 shrink-0 text-center" title={done ? "이번 주 클리어 완료" : "아직 안 감"}>
        {done ? "✅" : "⬜"}
      </span>
      <BossIcon boss={pick.boss} diff={pick.diff} size={64} showDiff={false} className={done ? "grayscale" : ""} />
      <span className="flex flex-col gap-0.5 min-w-0 w-40 sm:w-48 shrink-0 leading-tight">
        <span className="flex items-center gap-1.5 min-w-0">
          <DifficultyBadge diff={pick.diff} size="xs" solid />
          <span className="font-medium truncate" title={bossName(pick.boss)}>
            {bossName(pick.boss)}
          </span>
          {pick.source === "party" && (
            <span className="text-xs shrink-0" title="파티 등록에서 자동으로 들어온 보스">
              🔒
            </span>
          )}
        </span>
        <TierStars tier={tierOf(pick.boss, pick.diff)} size={11} />
      </span>
      <BossPartyInput ocid={ocid} bossKey={pick.key} party={pick.party} fromParty={pick.source === "party"} />
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
              {pick.party > 1 && price != null && (
                <span className="block text-[11px] text-zinc-500 tabular-nums">
                  {fmtPower(price)} ÷ {pick.party}
                </span>
              )}
            </>
          )}
        </span>
      </span>
    </li>
  );
}

/**
 * "이번 주 남은 보스" — 고른 보스 중 아직 안 간 것만.
 *
 * 앞으로 할 일만 보는 곳이라 이미 간 보스는 아예 빼고 개수만 센다.
 * 고르는 일은 아래 "보스" 목록에서 한다.
 */
export function RemainingBossList({
  picks,
  cleared,
  cap,
  priceDate,
  hasSnapshot,
  ocid,
}: {
  picks: MergedPick[];
  /** 이번 주 실제 클리어한 키 ("보스 난이도") */
  cleared: string[];
  cap: number;
  priceDate: string;
  hasSnapshot: boolean;
  ocid: string;
}) {
  const { remaining, done } = splitByCleared(picks, cleared);
  const left = picksTotals(remaining, priceDate);
  const all = picksTotals(picks, priceDate);
  const over = picks.length > cap;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-semibold">이번 주 남은 보스</h2>
        {picks.length > 0 && (
          <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
            {remaining.length}개 남음 / 고른 {picks.length}개{done.length > 0 && ` · ${done.length}개 완료`}
          </span>
        )}
        {remaining.length > 0 && (
          <span className="ml-auto flex items-baseline gap-1.5">
            <span className="text-xs text-zinc-500">남은 수익</span>
            <b className="text-lg tabular-nums text-orange-600 dark:text-orange-400">{fmtPower(left.value)}</b>
          </span>
        )}
      </div>

      {over && <div className="text-xs text-red-600">주간 입장 한도({cap})를 넘게 골랐습니다. 플래너에서는 실수령 상위 {cap}개만 배분됩니다.</div>}

      {picks.length === 0 ? (
        <div className="text-sm text-zinc-500">아직 고른 보스가 없습니다. 아래 &apos;보스&apos; 목록의 설정에서 이번 주에 갈 보스를 고르세요.</div>
      ) : remaining.length === 0 ? (
        <div className="text-sm text-emerald-700 dark:text-emerald-400">
          고른 {picks.length}개를 모두 돌았습니다. 실수령 {fmtPower(all.value)}.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {remaining.map((p) => (
            <BossRow key={p.key} pick={p} ocid={ocid} done={false} priceDate={priceDate} />
          ))}
        </ul>
      )}

      {picks.length > 0 && (
        <div className="text-[11px] text-zinc-400">
          {hasSnapshot
            ? "클리어한 보스는 이 목록에서 빠집니다. 판정은 인게임 스케줄러의 실제 클리어 기준이라, 잡고 나면 새로고침을 눌러야 반영됩니다."
            : "스케줄러 데이터가 없어 클리어 여부를 알 수 없습니다. 새로고침을 눌러 조회하면 간 보스가 빠집니다."}
        </div>
      )}
    </div>
  );
}

/**
 * "보스" — 내가 고른 보스 전체.
 *
 * 간 것까지 다 보여준다. 여기서만 설정을 열어 전체 보스와 난이도를 고른다.
 */
export function PickedBossList({
  picks,
  cleared,
  cap,
  priceDate,
  settings,
  extraCleared,
}: {
  picks: MergedPick[];
  cleared: string[];
  cap: number;
  priceDate: string;
  settings: BossSettingsModalProps;
  /** 고르지 않았는데 클리어한 주간 보스 (참고용) */
  extraCleared: { key: string; boss: string; diff: string; value: number }[];
}) {
  const { remaining, done } = splitByCleared(picks, cleared);
  const all = picksTotals(picks, priceDate);
  const over = picks.length > cap;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-semibold">보스</h2>
        <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
          고른 {picks.length}/{cap}개
        </span>
        {picks.length > 0 && (
          <>
            <span className="text-sm text-zinc-500">실수령 {fmtPower(all.value)}</span>
            <span className="text-sm text-zinc-400">정가 {fmtPower(all.gross)}</span>
          </>
        )}
        <div className="ml-auto">
          <BossSettingsModal {...settings} />
        </div>
      </div>

      {picks.length === 0 ? (
        <div className="text-sm text-zinc-500">아직 고른 보스가 없습니다. &apos;보스 설정&apos;을 눌러 고르세요.</div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[...remaining, ...done].map((p) => (
            <BossRow key={p.key} pick={p} ocid={settings.ocid} done={cleared.includes(p.key)} priceDate={priceDate} />
          ))}
        </ul>
      )}

      {extraCleared.length > 0 && (
        <div className="text-xs text-zinc-500">
          고르지 않았는데 클리어한 보스 {extraCleared.length}개 (수익 {fmtPower(extraCleared.reduce((s, x) => s + x.value, 0))}):{" "}
          {extraCleared.map((x) => `${x.boss} ${x.diff}`).join(", ")}
        </div>
      )}

      {picks.length > 0 && <div className="text-[11px] text-zinc-400">인원은 바꾸는 즉시 저장되고 플래너에도 반영됩니다. 간 보스는 아래에 흐리게 내려갑니다.</div>}
    </div>
  );
}
