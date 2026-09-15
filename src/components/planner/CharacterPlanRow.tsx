"use client";

import { useState } from "react";
import type { PlannerCharacter } from "@/services/planInput";
import type { CharPlanConfig, PlanProfile, PlanRow } from "@/lib/maple/planner";
import { normalizeBossList, parseBossKey } from "@/lib/maple/bossKey";
import { crystalPrice, isWeeklyCrystal, PRICE_TABLE } from "@/lib/maple/prices";
import { tierLabel, tierOf, type Tier } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { bossTag } from "@/lib/maple/bossMeta";
import { BossIcon } from "@/components/boss/BossIcon";

export function CharacterPlanRow({
  character: c,
  cfg,
  profile,
  row,
  priceDate,
  defaultParty,
  tierOptions,
  onPatch,
}: {
  character: PlannerCharacter;
  cfg: CharPlanConfig | undefined;
  profile: PlanProfile | null;
  row: PlanRow | null;
  priceDate: string;
  defaultParty: number;
  tierOptions: { key: string; tier: Tier }[];
  onPatch: (patch: Partial<CharPlanConfig> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const skip = cfg?.skip ?? false;
  const party = cfg?.party ?? defaultParty;
  const auto = cfg?.auto ?? !(cfg?.bosses && Object.keys(cfg.bosses).length);
  const bosses = Object.fromEntries(normalizeBossList(cfg?.bosses).map((b) => [b.key, b.party ?? party]));

  function setBosses(next: Record<string, number>) {
    onPatch({ bosses: next, auto: cfg?.auto ?? Object.keys(next).length === 0 });
  }

  const bossKeys = Object.entries(PRICE_TABLE.prices)
    .flatMap(([b, diffs]) => Object.keys(diffs).map((d) => `${b} ${d}`))
    .filter((k) => {
      const r = parseBossKey(k)!;
      return isWeeklyCrystal(r.boss, r.diff) && tierOf(r.boss, r.diff) && crystalPrice(r.boss, r.diff, priceDate) != null && !(k in bosses);
    })
    .sort((a, b) => (tierOf(parseBossKey(b)!.boss, parseBossKey(b)!.diff)?.rank ?? 0) - (tierOf(parseBossKey(a)!.boss, parseBossKey(a)!.diff)?.rank ?? 0));

  return (
    <div className={`card text-sm ${skip ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button className="font-semibold hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"} {c.name}
        </button>
        <span className="text-xs text-zinc-500">
          {c.cls} Lv.{c.level}
        </span>
        {profile?.ceiling ? (
          <span className="text-xs">
            상한 {profile.ceiling.boss} {profile.ceiling.diff} <span className="text-zinc-500">({tierLabel(profile.ceiling.tier)} · {profile.ceilingSource === "manual" ? "수동" : `실측 ${profile.clearedCount}클`})</span>
          </span>
        ) : (
          !skip && <span className="text-xs text-amber-700">상한 미파악 — 아래에서 지정</span>
        )}
        <span className="ml-auto text-xs text-zinc-500">{c.snapshotDates.length ? `스냅샷 ${c.snapshotDates.join(", ")}` : "스냅샷 없음"}</span>
        {row && (
          <span className="font-medium">
            {row.picks.length}개 {fmtPower(row.value)}
          </span>
        )}
      </div>

      {row && !open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.picks.map((p) => (
            <span key={`${p.boss}|${p.diff}`} className="inline-flex items-center gap-1" title={`${fmtPower(p.price)}${p.party > 1 ? ` ÷${p.party}` : ""} · ${tierLabel(p.tier)}${p.source === "party" ? " · 파티" : ""}`}>
              <BossIcon boss={p.boss} diff={p.diff} size={26} />
              <span className={`text-xs ${p.fixed ? "font-semibold" : ""}`}>
                {p.fixed && "📌"}
                {bossTag(p.boss, p.diff)}
                {p.party > 1 && <span className="opacity-60"> {p.party}인</span>}
              </span>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={skip} onChange={(e) => onPatch({ skip: e.target.checked })} /> 제외
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={auto} onChange={(e) => onPatch({ auto: e.target.checked })} /> 남는 슬롯 자동 채움
              </label>
              <label className="flex items-center gap-1">
                기본 인원
                <input type="number" className="input w-16 py-0.5" min={1} max={6} value={party} onChange={(e) => onPatch({ party: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} />
              </label>
            </div>
            <label className="block">
              <div className="text-xs text-zinc-500 mb-1">상한 수동 지정 (비우면 실측)</div>
              <select className="input" value={cfg?.ceiling ?? ""} onChange={(e) => onPatch({ ceiling: e.target.value || undefined })}>
                <option value="">실측 클리어 기준</option>
                {tierOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.key} ({tierLabel(o.tier)})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="text-xs text-zinc-500 mb-1">고정 픽 (보스 · 인원) — 파티 등록 항목은 자동 포함</div>
              <ul className="space-y-1">
                {Object.entries(bosses).map(([k, n]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="flex-1">
                      📌 {k} <span className="text-xs text-zinc-500">{tierLabel(tierOf(parseBossKey(k)!.boss, parseBossKey(k)!.diff))}</span>
                    </span>
                    <input type="number" className="input w-16 py-0.5" min={1} max={6} value={n} onChange={(e) => setBosses({ ...bosses, [k]: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} />
                    <button className="btn-ghost py-0.5" onClick={() => { const next = { ...bosses }; delete next[k]; setBosses(next); }}>
                      ×
                    </button>
                  </li>
                ))}
                {Object.entries(c.partyPicks).filter(([k]) => !(k in bosses)).map(([k, n]) => (
                  <li key={k} className="flex items-center gap-2 text-zinc-500">
                    <span className="flex-1">🔒 {k}</span>
                    <span className="text-xs">{n}인 (파티)</span>
                  </li>
                ))}
              </ul>
              <select className="input mt-1" value="" onChange={(e) => e.target.value && setBosses({ ...bosses, [e.target.value]: party })}>
                <option value="">+ 보스 추가</option>
                {bossKeys.map((k) => (
                  <option key={k} value={k}>
                    {k} · {tierLabel(tierOf(parseBossKey(k)!.boss, parseBossKey(k)!.diff))} · {fmtPower(crystalPrice(parseBossKey(k)!.boss, parseBossKey(k)!.diff, priceDate))}
                  </option>
                ))}
              </select>
            </div>
            <button className="text-xs underline text-zinc-500" onClick={() => onPatch(null)}>
              이 캐릭터 설정 초기화
            </button>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">배분 결과</div>
            {row ? (
              <table className="w-full">
                <tbody>
                  {row.picks.map((p) => (
                    <tr key={`${p.boss}|${p.diff}`} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-0.5 w-5">{p.fixed ? "📌" : ""}</td>
                      <td className="py-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <BossIcon boss={p.boss} diff={p.diff} size={24} />
                          {p.boss} <span className="text-xs text-zinc-500">{p.diff}</span>
                        </span>
                      </td>
                      <td className="py-0.5 text-xs text-zinc-500">{tierLabel(p.tier)}</td>
                      <td className="py-0.5 text-right whitespace-nowrap">
                        {fmtPower(p.price)}
                        {p.party > 1 && <span className="text-xs text-zinc-500"> ÷{p.party} = {fmtPower(p.value)}</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-zinc-300 dark:border-zinc-700 font-semibold">
                    <td colSpan={3} className="py-0.5">
                      합계 {row.picks.length}개
                    </td>
                    <td className="py-0.5 text-right">{fmtPower(row.value)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="text-zinc-500 text-xs">배분 없음</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
