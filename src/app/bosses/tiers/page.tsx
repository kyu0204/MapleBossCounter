import type { Metadata } from "next";
import { TIER_MAP, type Grade } from "@/lib/maple/tiers";
import { crystalPrice } from "@/lib/maple/prices";
import { kstDateStr } from "@/lib/maple/kst";
import { fmtPower } from "@/lib/maple/format";
import { parseBossKey } from "@/lib/maple/bossKey";

export const metadata: Metadata = {
  title: "보스 티어표",
  description: "메이플스토리 보스 난이도 티어(금·은·동·납)와 결정 가격을 한눈에",
};

const GRADES: Grade[] = ["금", "은", "동", "납"];
const GRADE_STYLE: Record<Grade, string> = {
  금: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200",
  은: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  동: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  납: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function TiersPage() {
  const priceDate = kstDateStr();
  const byGrade = new Map<Grade, Map<number, string[]>>();
  for (const [key, t] of Object.entries(TIER_MAP)) {
    if (!byGrade.has(t.grade)) byGrade.set(t.grade, new Map());
    const m = byGrade.get(t.grade)!;
    if (!m.has(t.stars)) m.set(t.stars, []);
    m.get(t.stars)!.push(key);
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">보스 티어표</h1>
        <p className="text-sm text-zinc-500">색(금 &gt; 은 &gt; 동 &gt; 납) + 별 개수. 괄호는 {priceDate} 기준 결정 가격(솔로). 출처: 나무위키 보스 티어.</p>
      </div>
      {GRADES.map((g) => (
        <section key={g} className="card">
          <h2 className={`inline-block rounded px-2 py-0.5 font-bold mb-3 ${GRADE_STYLE[g]}`}>{g}별</h2>
          <table className="w-full text-sm">
            <tbody>
              {[...(byGrade.get(g) ?? new Map<number, string[]>()).entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([stars, keys]) => (
                  <tr key={stars} className="border-t border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-500 w-28">{"★".repeat(stars)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {keys
                          .map((k) => ({ k, ref: parseBossKey(k)!, price: crystalPrice(parseBossKey(k)!.boss, parseBossKey(k)!.diff, priceDate) }))
                          .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
                          .map(({ k, ref, price }) => (
                            <span key={k}>
                              {ref.boss} <span className="text-xs text-zinc-500">{ref.diff}</span>
                              {price != null && <span className="text-xs text-zinc-400"> ({fmtPower(price)})</span>}
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
