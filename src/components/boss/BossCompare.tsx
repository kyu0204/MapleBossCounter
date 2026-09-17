"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRows, itemsIn, type ItemValues, type SortKey } from "@/lib/maple/compare";
import { bossName } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { ItemValueEditor } from "./ItemValueEditor";

/**
 * 보스끼리 한 번 잡았을 때의 값어치를 견주는 표.
 *
 * 결정만 보면 반쪽이라 확정 보상과 확률 드롭(물욕템)까지 더한다. 아이템 값어치는
 * 시세라 코드에 박을 수 없어 사용자가 넣는다. 안 넣은 아이템은 0 이고, 그 줄은
 * "값 미입력" 으로 표시해 합계가 실제보다 낮다는 것을 드러낸다.
 *
 * 입력값은 이 브라우저에만 둔다 (localStorage). 계정에 묶으면 시세가 사람마다
 * 다른데 한 값으로 굳는다.
 */
const VALUES_KEY = "maple-item-values";
const PARTY_KEY = "maple-compare-party";

export interface ComparePick {
  boss: string;
  diff: string;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "total", label: "합계" },
  { key: "crystal", label: "결정" },
  { key: "fixed", label: "확정 보상" },
  { key: "random", label: "랜덤 기대값" },
];

export function BossCompare({ picks, priceDate }: { picks: ComparePick[]; priceDate: string }) {
  const [values, setValues] = useState<ItemValues>({});
  const [party, setParty] = useState(1);
  const [sort, setSort] = useState<SortKey>("total");
  const [openValues, setOpenValues] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 첫 렌더는 서버와 같아야 하므로 저장값은 마운트 뒤에 읽는다
  useEffect(() => {
    try {
      const v = localStorage.getItem(VALUES_KEY);
      if (v) setValues(JSON.parse(v) as ItemValues);
      const p = Number(localStorage.getItem(PARTY_KEY));
      if (p >= 1 && p <= 6) setParty(p);
    } catch {
      // 사생활 보호 모드 등에서 막힐 수 있다. 값 없이 그냥 쓴다.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(VALUES_KEY, JSON.stringify(values));
      localStorage.setItem(PARTY_KEY, String(party));
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [values, party, loaded]);

  const items = useMemo(() => itemsIn(picks, priceDate), [picks, priceDate]);
  const rows = useMemo(() => compareRows(picks.map((p) => ({ ...p, party })), priceDate, values, sort), [picks, party, priceDate, values, sort]);
  const priced = Object.keys(values).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-zinc-500">인원</span>
          <input
            type="number"
            min={1}
            max={6}
            value={party}
            onChange={(e) => setParty(Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
            className="w-14 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-center tabular-nums"
          />
          <span className="text-zinc-500">인격</span>
        </label>

        <span className="flex items-center gap-1">
          <span className="text-zinc-500">정렬</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`rounded-md border px-2 py-0.5 text-xs ${sort === s.key ? "border-orange-400 bg-orange-50 font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
            >
              {s.label}
            </button>
          ))}
        </span>

        <button type="button" className="btn-ghost text-xs ml-auto" onClick={() => setOpenValues((v) => !v)}>
          아이템 값 {openValues ? "접기" : `설정 (${priced}/${items.length})`}
        </button>
      </div>

      {openValues && (
        <div className="card">
          <ItemValueEditor items={items} values={values} onChange={setValues} />
        </div>
      )}

      {priced === 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400">
          아이템 값을 아직 안 넣어 결정 메소만 견주고 있습니다. &apos;아이템 값 설정&apos;에서 값을 넣으면 보상까지 합쳐 비교합니다.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left font-normal py-1.5">보스</th>
              <th className="text-right font-normal">결정 (1인)</th>
              <th className="text-right font-normal">확정 보상</th>
              <th className="text-right font-normal">랜덤 기대값</th>
              <th className="text-right font-normal">합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.boss} ${r.diff}`} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <td className="py-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <BossIcon boss={r.boss} diff={r.diff} size={40} showDiff={false} />
                    <DifficultyBadge diff={r.diff} size="xs" solid />
                    <span className="truncate">{bossName(r.boss)}</span>
                    {r.hasUnpriced && (
                      <span className="text-[10px] text-zinc-400 shrink-0" title="값을 안 매긴 보상이 있어 합계가 실제보다 낮습니다">
                        값 미입력
                      </span>
                    )}
                  </span>
                </td>
                <td className="text-right tabular-nums">{r.crystal == null ? <span className="text-xs text-zinc-400">미등록</span> : fmtPower(r.crystal)}</td>
                <td className="text-right tabular-nums text-zinc-600 dark:text-zinc-300">{r.fixedValue ? fmtPower(r.fixedValue) : "-"}</td>
                <td className="text-right tabular-nums text-zinc-600 dark:text-zinc-300">{r.randomValue ? fmtPower(r.randomValue) : "-"}</td>
                <td className="text-right tabular-nums font-semibold">{fmtPower(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-400">
        결정은 가격표를 인원수로 나눈 값입니다. 조각·큐브는 파티 한 몫이 떨어져 인원수로 나뉘고 소수점은 버립니다. 랜덤은 단가 × 확률이며, 확률은 넥슨이 공개하지 않아 직접 넣은 추정값입니다.
      </p>
    </div>
  );
}
