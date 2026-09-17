import type { Metadata } from "next";
import Link from "next/link";
import { kstDateStr } from "@/lib/maple/kst";
import { BossCompare } from "@/components/boss/BossCompare";

export const metadata: Metadata = {
  title: "보스 보상 비교",
  description: "보스 둘을 골라 결정 메소와 보상 가치를 견줍니다. 인원수와 아이템 시세를 넣으면 한 번 잡을 때의 값어치가 나옵니다.",
};

export default function ComparePage() {
  const today = kstDateStr();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">보스 보상 비교</h1>
        <p className="text-sm text-zinc-500">
          보스 둘을 골라 맞대 놓고 견줍니다. 결정 메소만으로는 반쪽이라 확정 보상과 확률 드롭(물욕템)까지 값을 매겨 더합니다. 인원은 양쪽 따로 잡을 수 있습니다. 가격은 {today} 기준.
        </p>
        <p className="text-[11px] text-zinc-400">
          아이템 시세는 사람마다 다르고 자주 바뀌어 미리 넣어 두지 않았습니다. 직접 넣은 값만 합계에 들어가며 이 브라우저에만 저장됩니다.{" "}
          <Link href="/bosses/tiers" className="underline">
            티어표
          </Link>
          에서 전체 보상 목록을 볼 수 있습니다.
        </p>
      </div>

      <BossCompare today={today} />
    </div>
  );
}
