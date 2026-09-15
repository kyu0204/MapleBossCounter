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
        </div>
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
                      .map((k) => ({ k, ref: parseBossKey(k)!, price: crystalPrice(parseBossKey(k)!.boss, parseBossKey(k)!.diff, priceDate) }))
                      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
                      .map(({ k, ref, price }) => (
                        <span key={k} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 pl-1 pr-2 py-1">
                          <BossIcon boss={ref.boss} diff={ref.diff} size={44} showDiff={false} />
                          <span className="leading-tight">
                            <span className="flex items-center gap-1">
                              <DifficultyBadge diff={ref.diff} size="xs" solid />
                              <span className="font-medium">{bossShort(ref.boss)}</span>
                            </span>
                            <span className="block text-[11px] text-zinc-500">{price != null ? fmtPower(price) : "가격 미확인"}</span>
                          </span>
                        </span>
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
