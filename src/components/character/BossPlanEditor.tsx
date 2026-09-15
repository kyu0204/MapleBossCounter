"use client";

import { useMemo, useState, useTransition } from "react";
import { setCharacterBosses } from "@/actions/planner";
import { bossKey, parseBossKey, type Difficulty } from "@/lib/maple/bossKey";
import { crystalPrice, isWeeklyCrystal, PRICE_TABLE } from "@/lib/maple/prices";
import { tierLabel, tierOf } from "@/lib/maple/tiers";
import { bossShort, DIFF_SHORT, DIFF_STYLE } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { BossChip } from "@/components/boss/BossChip";
import { BossIcon } from "@/components/boss/BossIcon";

export interface BossPlanEditorProps {
  ocid: string;
  /** 주간 보스 입장 한도 (weekly_boss_clear_limit_count, 보통 12) */
  cap: number;
  defaultParty: number;
  /** 저장된 "갈 보스" { "보스 난이도": 인원 } */
  initial: Record<string, number>;
  /** 파티 등록에서 자동으로 들어오는 픽 (여기서 지울 수 없음) */
  partyPicks: Record<string, number>;
  /** 인게임 스케줄러에 등록된 주간 보스 키 */
  registered: string[];
  /** 이번 주 실제 클리어한 키 */
  cleared: string[];
  priceDate: string;
}

type BossRow = { boss: string; diffs: { diff: Difficulty; price: number; rank: number }[]; topRank: number };

export function BossPlanEditor({ ocid, cap, defaultParty, initial, partyPicks, registered, cleared, priceDate }: BossPlanEditorProps) {
  const [picks, setPicks] = useState<Record<string, number>>(initial);
  const [editing, setEditing] = useState(Object.keys(initial).length === 0 && Object.keys(partyPicks).length === 0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);

  /** 가격표의 주간 보스를 보스 단위로 묶고, 티어 높은 보스부터 */
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
    return out.sort((a, b) => b.topRank - a.topRank);
  }, [priceDate]);

  // 파티 유래는 항상 포함되고 수동 선택보다 우선순위가 낮다(같은 보스면 수동이 이김).
  const merged = useMemo(() => {
    const m: Record<string, { party: number; source: "config" | "party" }> = {};
    const bossesTaken = new Set(Object.keys(picks).map((k) => parseBossKey(k)?.boss));
    for (const [k, v] of Object.entries(picks)) m[k] = { party: v, source: "config" };
    for (const [k, v] of Object.entries(partyPicks)) {
      const b = parseBossKey(k)?.boss;
      if (b && bossesTaken.has(b)) continue;
      m[k] = { party: v, source: "party" };
    }
    return m;
  }, [picks, partyPicks]);

  const totals = useMemo(() => {
    let value = 0, gross = 0;
    for (const [k, { party }] of Object.entries(merged)) {
      const r = parseBossKey(k);
      const p = r && crystalPrice(r.boss, r.diff, priceDate);
      if (p == null) continue;
      gross += p;
      value += Math.floor(p / Math.max(1, party));
    }
    return { count: Object.keys(merged).length, value, gross };
  }, [merged, priceDate]);

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
      next[key] = partyPicks[key] ?? defaultParty;
      return next;
    });
    setMsg(null);
  }

  function setParty(key: string, party: number) {
    setPicks((prev) => ({ ...prev, [key]: Math.min(6, Math.max(1, party)) }));
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
      if (r.ok) setEditing(false);
    });
  }

  const selectedKeys = Object.keys(merged).sort((a, b) => {
    const ra = tierOf(parseBossKey(a)!.boss, parseBossKey(a)!.diff)?.rank ?? 0;
    const rb = tierOf(parseBossKey(b)!.boss, parseBossKey(b)!.diff)?.rank ?? 0;
    return rb - ra;
  });

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">이번 주 갈 보스</h2>
        <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
          {totals.count}/{cap}개
        </span>
        {totals.count > 0 && <span className="text-sm text-zinc-500">실수령 {fmtPower(totals.value)}</span>}
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <button className="btn-ghost text-xs" onClick={loadRegistered} disabled={!registered.length} title={registered.length ? "인게임 스케줄러에 등록해 둔 보스로 채웁니다" : "스케줄러 등록 정보가 없습니다"}>
                스케줄러 등록 불러오기
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setPicks(initial);
                  setEditing(false);
                  setMsg(null);
                }}
              >
                취소
              </button>
              <button className="btn-primary text-xs" onClick={save} disabled={pending}>
                {pending ? "저장 중…" : "저장"}
              </button>
            </>
          ) : (
            <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>
              보스 설정
            </button>
          )}
        </div>
      </div>

      {over && <div className="text-xs text-red-600">주간 입장 한도({cap})를 넘었습니다. 플래너에서는 실수령 상위 {cap}개만 배분됩니다.</div>}

      {selectedKeys.length === 0 ? (
        <div className="text-sm text-zinc-500">
          아직 선택한 보스가 없습니다.{!editing && " '보스 설정'을 눌러 이번 주에 갈 보스를 고르세요."}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedKeys.map((k) => {
            const r = parseBossKey(k)!;
            const { party, source } = merged[k];
            const price = crystalPrice(r.boss, r.diff, priceDate);
            return (
              <BossChip
                key={k}
                boss={r.boss}
                diff={r.diff}
                price={price}
                party={party}
                pinned={source === "config"}
                locked={source === "party"}
                onRemove={editing && source === "config" ? () => toggle(r.boss, r.diff) : undefined}
                right={
                  editing && source === "config" ? (
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={party}
                      onChange={(e) => setParty(k, Number(e.target.value))}
                      className="w-11 rounded border border-current/20 bg-white/60 dark:bg-black/20 px-1 py-0.5 text-xs"
                      title="파티 인원"
                      aria-label={`${r.boss} 파티 인원`}
                    />
                  ) : clearedSet.has(k) ? (
                    <span className="text-xs" title="이번 주 클리어 완료">
                      ✅
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      {editing && (
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">
            보스를 누르면 난이도를 고릅니다. 한 보스당 난이도 하나. 🔒 는 파티 등록에서 자동으로 들어온 항목이라 파티에서 빼야 사라집니다.
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const selectedKey = Object.keys(merged).find((k) => parseBossKey(k)?.boss === row.boss);
              const selectedDiff = selectedKey ? parseBossKey(selectedKey)!.diff : null;
              const fromParty = selectedKey ? merged[selectedKey].source === "party" : false;
              return (
                <div
                  key={row.boss}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${selectedDiff ? "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
                >
                  <BossIcon boss={row.boss} diff={selectedDiff ?? row.diffs[row.diffs.length - 1].diff} size={30} />
                  <span className="text-xs font-medium truncate flex-1 min-w-0" title={`${row.boss} · ${tierLabel(tierOf(row.boss, row.diffs[row.diffs.length - 1].diff))}`}>
                    {bossShort(row.boss)}
                  </span>
                  <span className="flex gap-0.5">
                    {row.diffs.map(({ diff, price }) => {
                      const on = selectedDiff === diff;
                      const style = DIFF_STYLE[diff];
                      return (
                        <button
                          key={diff}
                          type="button"
                          disabled={fromParty}
                          onClick={() => toggle(row.boss, diff)}
                          title={`${row.boss} ${diff} · ${fmtPower(price)}${fromParty ? " (파티 등록 항목)" : ""}`}
                          className={`w-6 h-6 rounded text-xs font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            on ? `${style.chip} ring-2 ${style.ring}` : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {DIFF_SHORT[diff]}
                        </button>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {msg && <div className={`text-sm ${msg.includes("오류") || msg.includes("아닙") ? "text-red-600" : "text-zinc-600 dark:text-zinc-400"}`}>{msg}</div>}
      {!editing && totals.count > 0 && (
        <div className="text-xs text-zinc-500">
          결정 정가 합 {fmtPower(totals.gross)} · 플래너에 그대로 고정 픽으로 들어갑니다.
        </div>
      )}
    </div>
  );
}
