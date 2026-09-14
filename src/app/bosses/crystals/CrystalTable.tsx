"use client";

import { useMemo, useState } from "react";
import type { PriceTable } from "@/lib/maple/prices";
import { tierOf, tierLabel } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";

type Prices = PriceTable["prices"];

function priceAt(entry: Prices[string][keyof Prices[string]], date: string): number | null {
  if (!entry) return null;
  if ("price" in entry) return entry.price;
  return date >= entry.new_from ? entry.new : entry.old;
}

export function CrystalTable({ table, changeDates, today }: { table: Prices; changeDates: string[]; today: string }) {
  const dateOptions = useMemo(() => {
    const opts = [{ label: `오늘 (${today})`, value: today }];
    for (const d of changeDates) if (d > today) opts.push({ label: `${d} 이후`, value: d });
    const before = changeDates.find((d) => d > today);
    if (before) opts.push({ label: `${before} 이전 (기존가)`, value: "1970-01-01" });
    return opts;
  }, [changeDates, today]);
  const [date, setDate] = useState(dateOptions[0].value);
  const [party, setParty] = useState(1);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const out: { boss: string; diff: string; price: number; tier: string; rank: number }[] = [];
    for (const [boss, diffs] of Object.entries(table)) {
      for (const [diff, entry] of Object.entries(diffs)) {
        const price = priceAt(entry, date);
        if (price == null) continue;
        const t = tierOf(boss, diff);
        out.push({ boss, diff, price, tier: tierLabel(t), rank: t?.rank ?? 0 });
      }
    }
    return out.filter((r) => !q || r.boss.includes(q)).sort((a, b) => b.price - a.price);
  }, [table, date, q]);

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">가격 기준일</div>
          <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
            {dateOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">파티 인원 {party}인</div>
          <input type="range" min={1} max={6} value={party} onChange={(e) => setParty(Number(e.target.value))} className="w-40" />
        </label>
        <label className="space-y-1 flex-1 min-w-40">
          <div className="text-xs text-zinc-500">보스 검색</div>
          <input className="input" placeholder="보스명" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="text-left">
              <th className="py-1">보스</th>
              <th className="py-1">난이도</th>
              <th className="py-1">티어</th>
              <th className="py-1 text-right">결정가</th>
              {party > 1 && <th className="py-1 text-right">÷{party} 실수령</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.boss}|${r.diff}`} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1">{r.boss}</td>
                <td className="py-1 text-zinc-500">{r.diff}</td>
                <td className="py-1 text-xs text-zinc-500">{r.tier}</td>
                <td className="py-1 text-right">{fmtPower(r.price)}</td>
                {party > 1 && <td className="py-1 text-right">{fmtPower(Math.floor(r.price / party))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
