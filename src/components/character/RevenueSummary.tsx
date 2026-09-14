import type { RevenueSummary as Rev } from "@/lib/maple/scheduler";
import { fmtPower } from "@/lib/maple/format";

export function RevenueSummary({ revenue, priceDate }: { revenue: Rev; priceDate: string }) {
  const rows = [
    ["주간", revenue.byCycle.bossWeekly],
    ["일간", revenue.byCycle.bossDaily],
    ["월간", revenue.byCycle.bossMonthly],
  ] as const;
  return (
    <div className="card text-sm space-y-2">
      <h3 className="font-semibold">결정 수익 추정</h3>
      <div className="text-xs text-zinc-500">{priceDate} 가격 · 파티 등록 인원 반영 · 전량 판매 가정</div>
      <table className="w-full">
        <tbody>
          {rows.filter(([, c]) => c.count).map(([label, c]) => (
            <tr key={label} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1">{label}</td>
              <td className="py-1 text-zinc-500">{c.count}개</td>
              <td className="py-1 text-right">{fmtPower(c.value)}</td>
            </tr>
          ))}
          <tr className="border-t border-zinc-300 dark:border-zinc-700 font-semibold">
            <td className="py-1">합계</td>
            <td />
            <td className="py-1 text-right">{fmtPower(revenue.totalValue)}</td>
          </tr>
        </tbody>
      </table>
      {revenue.totalGross !== revenue.totalValue && <div className="text-xs text-zinc-500">결정 정가 합 {fmtPower(revenue.totalGross)} (파티 분배 전)</div>}
      {revenue.unpriced.length > 0 && <div className="text-xs text-amber-700">가격 미등록: {revenue.unpriced.join(", ")}</div>}
    </div>
  );
}
