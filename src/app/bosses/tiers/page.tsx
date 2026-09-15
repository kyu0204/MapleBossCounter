import type { Metadata } from "next";
import { TIER_MAP } from "@/lib/maple/tiers";
import { crystalPrice } from "@/lib/maple/prices";
import { kstDateStr } from "@/lib/maple/kst";
import { fmtPower } from "@/lib/maple/format";
import { parseBossKey } from "@/lib/maple/bossKey";
import { bossShort, GRADE_COLOR } from "@/lib/maple/bossMeta";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";
import { DropList } from "@/components/boss/DropList";
import { hasRewards, DROP_SETS, DROP_SET_STYLE, REWARD_ITEMS_META } from "@/lib/maple/drops";

export const metadata: Metadata = {
  title: "보스 티어표",
  description: "메이플스토리 보스 난이도 티어와 결정 가격을 한눈에. 별 색과 개수로 난이도 순서를 표시합니다.",
};

export default function TiersPage() {
  const priceDate = kstDateStr();

  // (등급, 별) 조합을 rank 내림차순 한 줄씩. 등급 이름은 쓰지 않고 별 색으로만 구분한다.
  const byRank = new Map<number, { tier: (typeof TIER_MAP)[string]; keys: string[] }>();
  for (const [key, t] of Object.entries(TIER_MAP)) {
    if (!byRank.has(t.rank)) byRank.set(t.rank, { tier: t, keys: [] });
    byRank.get(t.rank)!.keys.push(key);
  }
  const rows = [...byRank.values()].sort((a, b) => b.tier.rank - a.tier.rank);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">보스 티어표</h1>
        <p className="text-sm text-zinc-500">
          별 색과 개수가 높을수록 상위 보스입니다. 가격은 {priceDate} 기준 솔로 판매가. 출처: 나무위키 보스 티어.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 pt-1">
          <span>난이도</span>
          {(["easy", "normal", "hard", "chaos", "extreme"] as const).map((d) => (
            <DifficultyBadge key={d} diff={d} full size="xs" solid />
          ))}
          <span className="ml-2">등급</span>
          {(["금", "은", "동", "납"] as const).map((g) => (
            <span key={g} className="text-base leading-none" style={{ color: GRADE_COLOR[g] }}>
              ★
            </span>
          ))}
          <span className="ml-2">드롭</span>
          {DROP_SETS.map((s) => (
            <span key={s} className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${DROP_SET_STYLE[s]}`}>
              {s}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400">
          보상은 나무위키 보스 문서의 &quot;주요 보상&quot;에서 가져왔습니다. 주간 보스만 수집했고, 난이도 전용 보상은 배지로 구분합니다(<code>+</code> 는 그 난이도 이상).
          (기준 {REWARD_ITEMS_META.updated})
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(({ tier, keys }) => (
              <tr key={tier.rank} className="border-t border-zinc-100 dark:border-zinc-800 align-top first:border-t-0">
                <td className="py-2.5 pr-3 whitespace-nowrap w-32">
                  <TierStars tier={tier} size={14} />
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-2">
                    {keys
                      .map((k) => {
                        const ref = parseBossKey(k)!;
                        return { k, ref, price: crystalPrice(ref.boss, ref.diff, priceDate), showDrops: hasRewards(ref.boss, ref.diff) };
                      })
                      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
                      .map(({ k, ref, price, showDrops }) => (
                        <div
                          key={k}
                          className={`flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1.5 ${showDrops ? "flex-1 min-w-[20rem]" : "min-w-[10rem]"}`}
                        >
                          <BossIcon boss={ref.boss} diff={ref.diff} size={72} showDiff={false} />
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 leading-tight">
                              <DifficultyBadge diff={ref.diff} size="xs" solid />
                              <span className="font-medium truncate">{bossShort(ref.boss)}</span>
                              <span className="ml-auto text-[11px] text-zinc-500 whitespace-nowrap">{price != null ? fmtPower(price) : "가격 미확인"}</span>
                            </div>
                            <DropList boss={ref.boss} diff={ref.diff} />
                          </div>
                        </div>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
