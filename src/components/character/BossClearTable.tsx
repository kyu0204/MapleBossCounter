import type { BossClearRow } from "@/lib/maple/scheduler";
import { crystalPrice } from "@/lib/maple/prices";
import { tierLabel } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";

const CYCLE_LABEL: Record<string, string> = { bossWeekly: "주간", bossDaily: "일간", bossMonthly: "월간" };

export function BossClearTable({ bosses, priceDate, partyOf, weekly }: { bosses: BossClearRow[]; priceDate: string; partyOf: (boss: string, diff: string) => number; weekly: string }) {
  const groups: Record<string, BossClearRow[]> = {};
  for (const b of bosses) (groups[b.cycle] ??= []).push(b);
  const order = ["bossWeekly", "bossDaily", "bossMonthly"];
  return (
    <div className="card space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">보스</h2>
        <span className="text-sm text-zinc-500">주간 {weekly} 클리어</span>
      </div>
      {order.filter((k) => groups[k]?.length).map((cycle) => (
        <div key={cycle}>
          <h3 className="text-xs font-medium text-zinc-500 mb-1">{CYCLE_LABEL[cycle] ?? cycle}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {groups[cycle].map((b) => {
                  const price = crystalPrice(b.boss, b.diff, priceDate);
                  const party = partyOf(b.boss, b.diff);
                  const value = price == null ? null : Math.floor(price / party);
                  return (
                    <tr key={`${b.boss}|${b.diff}`} className={`border-t border-zinc-100 dark:border-zinc-800 ${b.completed ? "" : "text-zinc-400"} ${!b.registered && !b.completed ? "hidden sm:table-row" : ""}`}>
                      <td className="py-1 w-6">{b.completed ? "✅" : "⬜"}</td>
                      <td className="py-1">
                        {b.boss} <span className="text-xs">{b.diff}</span>
                        {!b.registered && <span className="ml-1 text-[10px] text-zinc-400">미등록</span>}
                      </td>
                      <td className="py-1 text-xs text-zinc-500 whitespace-nowrap">{tierLabel(b.tier)}</td>
                      <td className="py-1 text-right whitespace-nowrap">
                        {price == null ? <span className="text-xs text-zinc-400">가격 미등록</span> : (
                          <>
                            {fmtPower(price)}
                            {party > 1 && <span className="text-xs text-zinc-500"> ÷{party} = {fmtPower(value)}</span>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-zinc-400">미등록·미클리어 행은 좁은 화면에서 숨김. 클리어 판정은 등록 여부와 무관하게 실제 클리어(complete_flag) 기준.</p>
    </div>
  );
}
