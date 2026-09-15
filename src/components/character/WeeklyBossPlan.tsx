import Link from "next/link";
import { crystalPrice } from "@/lib/maple/prices";
import { fmtPower } from "@/lib/maple/format";
import { picksTotals, splitByCleared, type MergedPick } from "@/lib/maple/bossPicks";
import { BossChip } from "@/components/boss/BossChip";

/**
 * "이번 주 갈 보스" — 읽기 전용.
 *
 * 아래 "보스 - 설정" 에서 고른 보스 중 아직 안 간 것만 남긴다.
 * 이미 클리어한 보스는 목록에서 빼고 개수만 센다 — 이 카드는 "앞으로 할 일" 이다.
 * 클리어 판정은 인게임 스케줄러의 complete_flag 기준이라 손으로 체크할 필요가 없다.
 */
export function WeeklyBossPlan({
  picks,
  cleared,
  cap,
  priceDate,
  settingsId,
  hasSnapshot,
}: {
  picks: MergedPick[];
  /** 이번 주 실제 클리어한 키 ("보스 난이도") */
  cleared: string[];
  /** 주간 보스 입장 한도 (weekly_boss_clear_limit_count, 보통 12) */
  cap: number;
  priceDate: string;
  /** "보스 - 설정" 카드의 앵커 id */
  settingsId: string;
  /** 스케줄러 스냅샷이 있는지 — 없으면 클리어 여부를 알 수 없다 */
  hasSnapshot: boolean;
}) {
  const { remaining, done } = splitByCleared(picks, cleared);
  const left = picksTotals(remaining, priceDate);
  const all = picksTotals(picks, priceDate);
  const over = picks.length > cap;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">이번 주 갈 보스</h2>
        {picks.length > 0 && (
          <>
            <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
              남은 {remaining.length}개 / 고른 {picks.length}개
            </span>
            {done.length > 0 && <span className="text-sm text-emerald-600 dark:text-emerald-400">{done.length}개 완료</span>}
            {remaining.length > 0 && <span className="text-sm text-zinc-500">남은 실수령 {fmtPower(left.value)}</span>}
          </>
        )}
        <Link href={`#${settingsId}`} className="ml-auto btn-ghost text-xs">
          보스 설정으로
        </Link>
      </div>

      {over && (
        <div className="text-xs text-red-600">
          주간 입장 한도({cap})를 넘게 골랐습니다. 플래너에서는 실수령 상위 {cap}개만 배분됩니다.
        </div>
      )}

      {picks.length === 0 ? (
        <div className="text-sm text-zinc-500">아직 고른 보스가 없습니다. 아래 &apos;보스 - 설정&apos;에서 이번 주에 갈 보스를 고르세요.</div>
      ) : remaining.length === 0 ? (
        <div className="text-sm text-emerald-700 dark:text-emerald-400">
          고른 {picks.length}개를 모두 돌았습니다. 실수령 {fmtPower(all.value)}.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {remaining.map((p) => (
            <BossChip key={p.key} boss={p.boss} diff={p.diff} price={crystalPrice(p.boss, p.diff, priceDate)} party={p.party} pinned={p.source === "config"} locked={p.source === "party"} />
          ))}
        </div>
      )}

      {picks.length > 0 && (
        <div className="text-xs text-zinc-500">
          {hasSnapshot
            ? "클리어한 보스는 목록에서 빠집니다. 판정은 인게임 스케줄러의 실제 클리어 기준이라, 잡고 나면 새로고침을 눌러야 반영됩니다."
            : "스케줄러 데이터가 없어 클리어 여부를 알 수 없습니다. 새로고침을 눌러 조회하면 간 보스가 목록에서 빠집니다."}
        </div>
      )}
    </div>
  );
}
