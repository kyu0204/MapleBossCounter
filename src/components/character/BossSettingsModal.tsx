"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setCharacterBosses } from "@/actions/planner";
import { bossKey, parseBossKey, type Difficulty } from "@/lib/maple/bossKey";
import { crystalPrice, isWeeklyCrystal, PRICE_TABLE } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { bossName, DIFF_LABEL } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { mergePicks, picksTotals, toPickList } from "@/lib/maple/bossPicks";
import { clampParty } from "@/lib/maple/partySize";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyButton } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";

export interface BossSettingsModalProps {
  ocid: string;
  /** 주간 보스 입장 한도 (weekly_boss_clear_limit_count, 보통 12) */
  cap: number;
  defaultParty: number;
  /** 저장된 "갈 보스" { "보스 난이도": 인원 } */
  initial: Record<string, number>;
  /** 파티 등록에서 자동으로 들어오는 픽 */
  partyPicks: Record<string, number>;
  /** 인게임 스케줄러에 등록된 주간 보스 키 */
  registered: string[];
  priceDate: string;
}

type BossRow = { boss: string; diffs: { diff: Difficulty; price: number; rank: number }[]; topRank: number };

/**
 * "보스 설정" 버튼 + 모달.
 *
 * 목록 카드에는 고른 보스만 보이고, 전체 보스와 난이도는 여기서만 펼친다.
 * 저장하면 플래너와 같은 저장소(plan_configs)에 들어가 양쪽이 같은 목록을 본다.
 */
export function BossSettingsModal({ ocid, cap, defaultParty, initial, partyPicks, registered, priceDate }: BossSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // 모달이 떠 있는 동안 뒤 화면이 스크롤되지 않게
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dirty = useMemo(() => {
    const norm = (o: Record<string, number>) =>
      JSON.stringify(
        Object.keys(o)
          .sort()
          .map((k) => [k, o[k]]),
      );
    return norm(picks) !== norm(initial);
  }, [picks, initial]);

  /** 가격표의 주간 보스를 보스 단위로 묶고, 난이도 낮은 보스부터 (목록과 같은 순서) */
  const rows = useMemo<BossRow[]>(() => {
    const out: BossRow[] = [];
    for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
      const list: BossRow["diffs"] = [];
      for (const diff of Object.keys(diffs) as Difficulty[]) {
        if (!isWeeklyCrystal(boss, diff)) continue;
        const price = crystalPrice(boss, diff, priceDate);
        const t = tierOf(boss, diff);
        if (price == null || !t) continue;
        list.push({ diff, price, rank: t.rank });
      }
      if (!list.length) continue;
      list.sort((a, b) => a.rank - b.rank);
      out.push({ boss, diffs: list, topRank: Math.max(...list.map((d) => d.rank)) });
    }
    return out.sort((a, b) => a.topRank - b.topRank || a.boss.localeCompare(b.boss, "ko"));
  }, [priceDate]);

  const merged = useMemo(() => mergePicks(picks, partyPicks), [picks, partyPicks]);
  const list = useMemo(() => toPickList(merged, priceDate), [merged, priceDate]);
  const totals = useMemo(() => picksTotals(list, priceDate), [list, priceDate]);
  const over = totals.count > cap;

  function toggle(boss: string, diff: Difficulty) {
    const key = bossKey(boss, diff);
    setPicks((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) {
        delete next[key];
        return next;
      }
      // 같은 보스의 다른 난이도는 교체 (캐릭터·보스당 난이도 1개)
      for (const k of Object.keys(next)) if (parseBossKey(k)?.boss === boss) delete next[k];
      // 기본 인원이 이 보스의 상한을 넘으면 잘라 넣는다 (3인 보스에 6인이 박히면 안 된다)
      next[key] = clampParty(boss, diff, partyPicks[key] ?? defaultParty);
      return next;
    });
    setMsg(null);
  }

  function loadRegistered() {
    const next: Record<string, number> = {};
    const seen = new Set<string>();
    for (const k of registered) {
      const r = parseBossKey(k);
      if (!r || seen.has(r.boss)) continue;
      if (!isWeeklyCrystal(r.boss, r.diff) || crystalPrice(r.boss, r.diff, priceDate) == null || !tierOf(r.boss, r.diff)) continue;
      seen.add(r.boss);
      next[k] = picks[k] ?? partyPicks[k] ?? defaultParty;
    }
    setPicks(next);
    setMsg(`인게임 스케줄러 등록 ${Object.keys(next).length}개를 불러왔습니다. 저장을 눌러야 반영됩니다.`);
  }

  function save() {
    start(async () => {
      const r = await setCharacterBosses(ocid, picks);
      setMsg(r.message);
      if (r.ok) setOpen(false);
    });
  }

  return (
    <>
      <button
        className="btn-ghost text-xs"
        onClick={() => {
          // 열 때마다 서버에 저장된 현재 값에서 시작한다 (저장 후 재검증된 값 반영)
          setPicks(initial);
          setMsg(null);
          setOpen(true);
        }}
      >
        보스 설정
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="보스 설정"
            tabIndex={-1}
            className="w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl outline-none"
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 py-3">
              <h2 className="font-semibold">보스 설정</h2>
              <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                {totals.count}/{cap}개
              </span>
              {totals.count > 0 && <span className="text-sm text-zinc-500">실수령 {fmtPower(totals.value)}</span>}
              {dirty && <span className="text-sm text-amber-600">저장 안 됨</span>}
              <div className="ml-auto flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={loadRegistered} disabled={!registered.length} title={registered.length ? "인게임 스케줄러에 등록해 둔 보스로 채웁니다" : "스케줄러 등록 정보가 없습니다"}>
                  스케줄러 등록 불러오기
                </button>
                <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>
                  닫기
                </button>
                <button className="btn-primary text-xs" onClick={save} disabled={pending || !dirty}>
                  {pending ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {over && <div className="text-xs text-red-600">주간 입장 한도({cap})를 넘었습니다. 실제로는 이 중 {cap}개만 입장할 수 있습니다.</div>}
              <div className="text-xs text-zinc-500">
                보스를 누르면 난이도를 고릅니다. 한 보스당 난이도 하나. 🔒 는 파티 등록에서 자동으로 들어온 항목이라 파티에서 빼야 사라집니다. 인원은 목록에서 바꾸되, 같은 보스·난이도로 등록한 파티가 있으면 그 파티의 구성원 수를 그대로 씁니다.
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                  const hit = list.find((p) => p.boss === row.boss);
                  const selectedDiff = hit?.diff ?? null;
                  const fromParty = hit?.source === "party";
                  return (
                    <div
                      key={row.boss}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${selectedDiff ? "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
                    >
                      <BossIcon boss={row.boss} diff={selectedDiff ?? row.diffs[row.diffs.length - 1].diff} size={56} showDiff={false} />
                      <span className="flex flex-col gap-0.5 flex-1 min-w-0 leading-tight">
                        <span className="text-sm font-medium truncate" title={row.boss}>
                          {bossName(row.boss)}
                          {fromParty && <span className="ml-1 text-xs">🔒</span>}
                        </span>
                        <TierStars tier={tierOf(row.boss, row.diffs[row.diffs.length - 1].diff)} size={10} />
                      </span>
                      <span className="flex gap-1">
                        {row.diffs.map(({ diff, price }) => (
                          <DifficultyButton
                            key={diff}
                            diff={diff}
                            active={selectedDiff === diff}
                            disabled={fromParty}
                            onClick={() => toggle(row.boss, diff)}
                            title={`${row.boss} ${DIFF_LABEL[diff]} · ${fmtPower(price)}${fromParty ? " (파티 등록 항목)" : ""}`}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
              {msg && <div className={`text-sm ${msg.includes("오류") || msg.includes("아닙") ? "text-red-600" : "text-zinc-600 dark:text-zinc-400"}`}>{msg}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
