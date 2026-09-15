"use client";

import { useMemo, useState, useTransition } from "react";
import { setCharacterBosses } from "@/actions/planner";
import { bossKey, parseBossKey, type Difficulty } from "@/lib/maple/bossKey";
import { crystalPrice, isWeeklyCrystal, PRICE_TABLE } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { bossName, DIFF_LABEL } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { mergePicks, picksTotals, toPickList } from "@/lib/maple/bossPicks";
import { BossChip } from "@/components/boss/BossChip";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyButton } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";

export interface BossSettingsProps {
  id: string;
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

/**
 * "보스 - 설정" — 이번 주에 갈 보스를 고르는 곳.
 *
 * 저장하면 플래너와 같은 저장소(plan_configs)에 들어가서 양쪽이 항상 같은 목록을 본다.
 * 위쪽 "이번 주 갈 보스" 카드는 여기서 고른 것 중 아직 안 간 것만 보여준다.
 * 저장 후 페이지가 다시 그려지며 그 카드도 같이 갱신된다.
 */
export function BossSettings({ id, ocid, cap, defaultParty, initial, partyPicks, registered, cleared, priceDate }: BossSettingsProps) {
  const [picks, setPicks] = useState<Record<string, number>>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  // 고른 것이 하나도 없으면 바로 펼쳐 준다. 이미 골라 뒀으면 접어 둔다.
  const [open, setOpen] = useState(Object.keys(initial).length === 0 && Object.keys(partyPicks).length === 0);
  const [pending, start] = useTransition();

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);
  // 키 순서가 바뀌어도 내용이 같으면 변경으로 보지 않는다 (토글하다 원래대로 돌아온 경우)
  const dirty = useMemo(() => {
    const norm = (o: Record<string, number>) =>
      JSON.stringify(
        Object.keys(o)
          .sort()
          .map((k) => [k, o[k]]),
      );
    return norm(picks) !== norm(initial);
  }, [picks, initial]);

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

  const merged = useMemo(() => mergePicks(picks, partyPicks), [picks, partyPicks]);
  const list = useMemo(() => toPickList(merged), [merged]);
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
    });
  }

  return (
    <div id={id} className="card space-y-3 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">보스 - 설정</h2>
        <span className={`text-sm ${over ? "text-red-600 font-medium" : "text-zinc-500"}`}>
          {totals.count}/{cap}개
        </span>
        {totals.count > 0 && <span className="text-sm text-zinc-500">실수령 {fmtPower(totals.value)}</span>}
        {dirty && <span className="text-sm text-amber-600">저장 안 됨</span>}
        <button className="ml-auto btn-ghost text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "접기" : "펼쳐서 고르기"}
        </button>
      </div>

      {over && <div className="text-xs text-red-600">주간 입장 한도({cap})를 넘었습니다. 플래너에서는 실수령 상위 {cap}개만 배분됩니다.</div>}

      {list.length === 0 ? (
        <div className="text-sm text-zinc-500">아직 고른 보스가 없습니다.{!open && " '펼쳐서 고르기'를 누르세요."}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((p) => (
            <BossChip
              key={p.key}
              boss={p.boss}
              diff={p.diff}
              price={crystalPrice(p.boss, p.diff, priceDate)}
              party={p.party}
              pinned={p.source === "config"}
              locked={p.source === "party"}
              onRemove={open && p.source === "config" ? () => toggle(p.boss, p.diff) : undefined}
              right={
                open && p.source === "config" ? (
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={p.party}
                    onChange={(e) => setParty(p.key, Number(e.target.value))}
                    className="w-11 rounded border border-current/20 bg-white/60 dark:bg-black/20 px-1 py-0.5 text-xs"
                    title="파티 인원"
                    aria-label={`${p.boss} 파티 인원`}
                  />
                ) : clearedSet.has(p.key) ? (
                  <span className="text-xs" title="이번 주 클리어 완료">
                    ✅
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-zinc-500 flex-1 min-w-[16rem]">
              보스를 누르면 난이도를 고릅니다. 한 보스당 난이도 하나. 🔒 는 파티 등록에서 자동으로 들어온 항목이라 파티에서 빼야 사라집니다.
            </div>
            <button className="btn-ghost text-xs" onClick={loadRegistered} disabled={!registered.length} title={registered.length ? "인게임 스케줄러에 등록해 둔 보스로 채웁니다" : "스케줄러 등록 정보가 없습니다"}>
              스케줄러 등록 불러오기
            </button>
            <button className="btn-ghost text-xs" onClick={() => { setPicks(initial); setMsg(null); }} disabled={!dirty}>
              되돌리기
            </button>
            <button className="btn-primary text-xs" onClick={save} disabled={pending || !dirty}>
              {pending ? "저장 중…" : "저장"}
            </button>
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
                  <BossIcon boss={row.boss} diff={selectedDiff ?? row.diffs[row.diffs.length - 1].diff} size={44} showDiff={false} />
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0 leading-tight">
                    <span className="text-sm font-medium truncate" title={row.boss}>
                      {bossName(row.boss)}
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
        </div>
      )}

      {msg && <div className={`text-sm ${msg.includes("오류") || msg.includes("아닙") ? "text-red-600" : "text-zinc-600 dark:text-zinc-400"}`}>{msg}</div>}
      {totals.count > 0 && <div className="text-xs text-zinc-500">결정 정가 합 {fmtPower(totals.gross)} · 플래너에 그대로 고정 픽으로 들어갑니다.</div>}
    </div>
  );
}
