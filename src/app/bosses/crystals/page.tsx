import type { Metadata } from "next";
import { PRICE_TABLE, priceChangeDates } from "@/lib/maple/prices";
import { kstDateStr } from "@/lib/maple/kst";
import { CrystalTable } from "./CrystalTable";

export const metadata: Metadata = {
  title: "결정 가격표 · 계산기",
  description: "메이플스토리 보스 결정(강렬한 힘의 결정) 판매 가격표와 파티 인원별 실수령 계산기. 2026-09-17 패치 반영.",
};

export default function CrystalsPage() {
  // 클라이언트 컴포넌트에 가격표 전체를 넘긴다 (JSON 7KB)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">결정 가격표 · 계산기</h1>
        <p className="text-sm text-zinc-500">
          기준일과 파티 인원을 바꾸면 실수령(가격 ÷ 인원)이 바로 계산됩니다. 캐릭터당 주간 보스 12회, 월드당 주간 결정 판매 한도(패치노트에 숫자 없음, 커뮤니티 기준 90개).
        </p>
      </div>
      <CrystalTable table={PRICE_TABLE.prices} changeDates={priceChangeDates()} today={kstDateStr()} />
      <details className="text-xs text-zinc-500">
        <summary>출처·주의</summary>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          {(PRICE_TABLE._meta.sources ?? []).map((s) => (
            <li key={s}>{s}</li>
          ))}
          {(PRICE_TABLE._meta.notes ?? []).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
