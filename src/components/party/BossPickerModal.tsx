"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { crystalPrice, isWeeklyCrystal, PRICE_TABLE } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { bossName, DIFF_LABEL } from "@/lib/maple/bossMeta";
import type { Difficulty } from "@/lib/maple/bossKey";
import { fmtPower } from "@/lib/maple/format";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge, DifficultyButton } from "@/components/boss/DifficultyBadge";

type BossRow = { boss: string; diffs: { diff: Difficulty; price: number; rank: number }[]; topRank: number };

/**
 * 보스 아이콘 하나만 놓고, 누르면 모달에서 고른다.
 *
 * 폼 안에 보스 목록을 통째로 펼쳐 두면 일정·구성원이 한참 아래로 밀린다.
 * 고르는 일은 한 번뿐이니 모달로 빼고 자리에는 고른 결과만 남긴다.
 */
export function BossPickerModal({
  boss,
  diff,
  today,
  onPick,
}: {
  boss: string;
  diff: string;
  today: string;
  onPick: (boss: string, diff: Difficulty) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /** 캐릭터 보스 설정과 같은 목록·같은 순서 (난이도 낮은 보스부터) */
  const rows = useMemo<BossRow[]>(() => {
    const out: BossRow[] = [];
    for (const [b, diffs] of Object.entries(PRICE_TABLE.prices)) {
      const list: BossRow["diffs"] = [];
      for (const d of Object.keys(diffs) as Difficulty[]) {
        if (!isWeeklyCrystal(b, d)) continue;
        const price = crystalPrice(b, d, today);
        const t = tierOf(b, d);
        if (price == null || !t) continue;
        list.push({ diff: d, price, rank: t.rank });
      }
      if (!list.length) continue;
      list.sort((a, b2) => a.rank - b2.rank);
      out.push({ boss: b, diffs: list, topRank: Math.max(...list.map((x) => x.rank)) });
    }
    return out.sort((a, b) => a.topRank - b.topRank || a.boss.localeCompare(b.boss, "ko"));
  }, [today]);

  const price = boss && diff ? crystalPrice(boss, diff, today) : null;
  const picked = !!boss && !!diff;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 text-left hover:border-orange-300 dark:hover:border-orange-800 transition"
        title="눌러서 보스 고르기"
      >
        {picked ? (
          <>
            <BossIcon boss={boss} diff={diff} size={72} showDiff={false} />
            <span className="flex flex-col gap-1 leading-tight">
              <span className="flex items-center gap-1.5">
                <DifficultyBadge diff={diff} size="xs" solid />
                <b>{bossName(boss)}</b>
              </span>
              <span className="text-xs text-zinc-500">결정 {fmtPower(price)}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400" style={{ width: 72, height: 72 }}>
              ?
            </span>
            <span className="text-sm text-zinc-500">보스 고르기</span>
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="보스 고르기"
            tabIndex={-1}
            className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl outline-none"
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 py-3">
              <h2 className="font-semibold">보스 고르기</h2>
              {picked && (
                <span className="text-sm text-zinc-500">
                  {DIFF_LABEL[diff as Difficulty] ?? diff} {bossName(boss)} · {fmtPower(price)}
                </span>
              )}
              <button className="ml-auto btn-ghost text-xs" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-zinc-500">난이도 버튼을 누르면 고르고 닫힙니다. 난이도 낮은 보스부터 나옵니다.</div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                  const selected = row.boss === boss;
                  return (
                    <div
                      key={row.boss}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${selected ? "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
                    >
                      <BossIcon boss={row.boss} diff={(selected ? (diff as Difficulty) : null) ?? row.diffs[row.diffs.length - 1].diff} size={56} showDiff={false} />
                      <span className="text-sm font-medium truncate flex-1 min-w-0" title={row.boss}>
                        {bossName(row.boss)}
                      </span>
                      <span className="flex gap-1">
                        {row.diffs.map(({ diff: d, price: p }) => (
                          <DifficultyButton
                            key={d}
                            diff={d}
                            active={selected && diff === d}
                            onClick={() => {
                              onPick(row.boss, d);
                              setOpen(false);
                            }}
                            title={`${row.boss} ${DIFF_LABEL[d]} · ${fmtPower(p)}`}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
