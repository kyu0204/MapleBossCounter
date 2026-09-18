"use client";

import type { ItemRef, ItemValues } from "@/lib/maple/compare";
import { ICON_BOX } from "@/lib/maple/rewards";
import { fmtMesoFull, fmtPower } from "@/lib/maple/format";

/**
 * 아이템 값어치 입력.
 *
 * 시세는 사람마다·때마다 달라서 코드에 박지 않는다. 여기서 받은 값만 합계에 들어가고,
 * 안 넣은 아이템은 0 으로 쳐서 비교에서 빠진다 — 짐작해서 채우면 비교가 거짓말이 된다.
 *
 * 확률 드롭은 확률도 받는다. 넥슨이 드롭률을 공개하지 않아 추정값을 쓸 수밖에 없다.
 * 단가와 확률 둘 다 있어야 기대값이 나온다.
 */
export function ItemValueEditor({ items, values, onChange }: { items: ItemRef[]; values: ItemValues; onChange: (next: ItemValues) => void }) {
  const set = (name: string, patch: { meso?: number; chance?: number }) => {
    const next = { ...values, [name]: { ...values[name], ...patch } };
    // 빈 값은 키째 지운다. 0 을 남겨 두면 "값을 매겼는데 0" 과 구분이 안 된다.
    const v = next[name];
    if (!v.meso && !v.chance) delete next[name];
    onChange(next);
  };

  const num = (s: string) => {
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500">
        값을 넣은 아이템만 합계에 들어갑니다. 확률 드롭은 <b>단가와 확률이 둘 다</b> 있어야 기대값이 잡힙니다. 입력값은 이 브라우저에만 저장됩니다.
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((it) => {
          const v = values[it.name] ?? {};
          const expected = it.asRandom && v.meso && v.chance ? Math.floor((v.meso * v.chance) / 100) : null;
          return (
            <li key={it.name} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1.5">
              <span className="inline-flex items-center justify-center shrink-0" style={{ width: ICON_BOX.w, height: ICON_BOX.h }}>
                {it.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.icon} alt="" width={it.w} height={it.h} style={{ width: it.w, height: it.h }} className="object-contain" loading="lazy" decoding="async" />
                ) : (
                  <span className="text-[10px] leading-none text-center">{it.short ?? it.name}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs" title={it.name}>
                  {it.name}
                </span>
                <span className="flex items-center gap-1 pt-0.5">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={v.meso ?? ""}
                    onChange={(e) => set(it.name, { meso: num(e.target.value) })}
                    placeholder="단가"
                    aria-label={`${it.name} 단가(메소)`}
                    className="w-24 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5 text-xs tabular-nums"
                  />
                  {/* 0 을 몇 개 쳤는지 눈으로 세지 않아도 되게 되읽어 준다. 여기서는 끝자리를 버리지 않는다. */}
                  {v.meso ? <span className="text-[10px] text-zinc-500 tabular-nums whitespace-nowrap">{fmtMesoFull(v.meso)}</span> : null}
                  {it.asRandom && (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={v.chance ?? ""}
                        onChange={(e) => set(it.name, { chance: num(e.target.value) })}
                        placeholder="확률"
                        aria-label={`${it.name} 획득 확률(%)`}
                        className="w-16 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5 text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-zinc-400">%</span>
                    </>
                  )}
                  {expected != null && <span className="text-[10px] text-zinc-500 tabular-nums">= {fmtPower(expected)}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
