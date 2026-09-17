import type { Metadata } from "next";
import Link from "next/link";
import { kstDateStr } from "@/lib/maple/kst";
import { isWeeklyCrystal, PRICE_TABLE, crystalPrice } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { hasRewardsFor } from "@/lib/maple/rewards";
import { BossCompare, type ComparePick } from "@/components/boss/BossCompare";
import type { Difficulty } from "@/lib/maple/bossKey";

export const metadata: Metadata = {
  title: "보스 보상 비교",
  description: "주간 보스를 결정 메소와 보상 가치로 견줍니다. 인원수와 아이템 시세를 넣으면 한 번 잡을 때의 값어치가 나옵니다.",
};

/**
 * 비교 대상: 주간 결정이 나오는 보스·난이도 전부.
 *
 * 일간·월간은 뺀다. 주간 12회 한도 안에서 무엇을 고를지가 이 화면의 쓸모라,
 * 주기가 다른 보스를 같이 놓으면 견줄 기준이 어긋난다.
 */
export default function ComparePage() {
  const priceDate = kstDateStr();
  const picks: ComparePick[] = [];
  for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
    for (const diff of Object.keys(diffs) as Difficulty[]) {
      if (!isWeeklyCrystal(boss, diff)) continue;
      // 가격도 보상도 없으면 견줄 것이 없다
      if (crystalPrice(boss, diff, priceDate) == null && !hasRewardsFor(boss, diff, priceDate)) continue;
      if (!tierOf(boss, diff)) continue;
      picks.push({ boss, diff });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">보스 보상 비교</h1>
        <p className="text-sm text-zinc-500">
          결정 메소만으로는 반쪽입니다. 확정 보상과 확률 드롭(물욕템)까지 값을 매겨 한 번 잡을 때의 값어치를 견줍니다. 가격은 {priceDate} 기준.
        </p>
        <p className="text-[11px] text-zinc-400">
          아이템 시세는 사람마다 다르고 자주 바뀌어 미리 넣어 두지 않았습니다. 직접 넣은 값만 합계에 들어갑니다.{" "}
          <Link href="/bosses/tiers" className="underline">
            티어표
          </Link>
          에서 보상 목록을 볼 수 있습니다.
        </p>
      </div>

      <BossCompare picks={picks} priceDate={priceDate} />
    </div>
  );
}
