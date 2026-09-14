"use client";

import { useMemo, useState, useTransition } from "react";
import type { PlannerWorldInput, PlannerCharacter } from "@/services/planInput";
import { allocatePlan, buildProfile, initCharConfigFromRegistration, type CharPlanConfig, type PlanConfig, type PlanProfile } from "@/lib/maple/planner";
import { weeklyCandidates } from "@/lib/maple/prices";
import { tierKeysByRank, tierLabel, tierOf } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { savePlanConfig } from "@/actions/planner";
import { CharacterPlanRow } from "./CharacterPlanRow";

export function PlannerBoard({ worlds, today, changeDates }: { worlds: PlannerWorldInput[]; today: string; changeDates: string[] }) {
  const [worldIdx, setWorldIdx] = useState(0);
  const [configs, setConfigs] = useState<Record<string, PlanConfig>>(() => Object.fromEntries(worlds.map((w) => [w.world, w.config])));
  const [priceDate, setPriceDate] = useState(today);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const w = worlds[worldIdx];
  const cfg = configs[w.world];
  const limit = cfg.world_limit ?? 90;
  const defaultParty = cfg.default_party ?? 1;

  const dateOptions = useMemo(() => {
    const opts = [{ label: `오늘 (${today})`, value: today }];
    for (const d of changeDates) if (d > today) opts.push({ label: `${d} 이후`, value: d });
    return opts;
  }, [changeDates, today]);

  const { profiles, warnings, byId } = useMemo(() => {
    const profiles: PlanProfile[] = [];
    const warnings: string[] = [];
    const byId: Record<string, PlannerCharacter> = {};
    for (const c of w.characters) {
      byId[c.ocid] = c;
      const cc = cfg.characters[c.ocid];
      if (cc?.skip || (c.hidden && !cc)) continue;
      const r = buildProfile({ charId: c.ocid, name: c.name, cls: c.cls ?? undefined, level: c.level ?? undefined, world: c.world ?? undefined, cfg: cc, defaultParty, priceDate, snapshotBosses: c.clearedWeekly, cap: c.cap, partyPicks: c.partyPicks });
      profiles.push(r.profile);
      warnings.push(...r.warnings);
    }
    return { profiles, warnings, byId };
  }, [w, cfg, defaultParty, priceDate]);

  const plan = useMemo(() => allocatePlan({ priceDate, worldLimit: limit, candidates: weeklyCandidates(priceDate), profiles }), [priceDate, limit, profiles]);
  const rowById = Object.fromEntries(plan.rows.map((r) => [r.charId, r]));
  const tierOptions = useMemo(() => tierKeysByRank(), []);

  function patchChar(ocid: string, patch: Partial<CharPlanConfig> | null) {
    setConfigs((all) => {
      const next = { ...all[w.world], characters: { ...all[w.world].characters } };
      if (patch === null) delete next.characters[ocid];
      else next.characters[ocid] = { ...next.characters[ocid], ...patch };
      return { ...all, [w.world]: next };
    });
  }
  function patchWorld(patch: Partial<PlanConfig>) {
    setConfigs((all) => ({ ...all, [w.world]: { ...all[w.world], ...patch } }));
  }
  function initFromRegistration() {
    const next: Record<string, CharPlanConfig> = {};
    const lines: string[] = [];
    for (const c of w.characters) {
      const r = initCharConfigFromRegistration({ name: c.name, keep: cfg.characters[c.ocid], defaultParty, priceDate, bosses: c.registeredWeekly.length || c.clearedWeekly.length ? [...c.registeredWeekly, ...c.clearedWeekly.flat()] : null, cap: c.cap });
      next[c.ocid] = r.cfg;
      lines.push(r.summary);
    }
    patchWorld({ characters: next });
    setMsg(`스케줄러 등록 기준으로 초기화: ${lines.length}명`);
  }
  function save() {
    start(async () => {
      const r = await savePlanConfig(w.world, configs[w.world]);
      setMsg(r.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {worlds.map((x, i) => (
          <button key={x.world} className={`btn-ghost ${i === worldIdx ? "bg-zinc-100 dark:bg-zinc-800" : ""}`} onClick={() => setWorldIdx(i)}>
            {x.world} <span className="text-xs text-zinc-500">{x.characters.length}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">가격</span>
            <select className="input w-auto py-1" value={priceDate} onChange={(e) => setPriceDate(e.target.value)}>
              {dateOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">월드 한도</span>
            <input type="number" className="input w-20 py-1" min={1} max={500} value={limit} onChange={(e) => patchWorld({ world_limit: Number(e.target.value) || 90 })} />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">기본 인원</span>
            <input type="number" className="input w-16 py-1" min={1} max={6} value={defaultParty} onChange={(e) => patchWorld({ default_party: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })} />
          </label>
          <button className="btn-ghost" onClick={initFromRegistration}>
            스케줄러 등록으로 초기화
          </button>
          <button className="btn-primary" disabled={pending} onClick={save}>
            {pending ? "저장 중…" : "설정 저장"}
          </button>
        </div>
      </div>
      {msg && <div className="text-sm text-zinc-600">{msg}</div>}

      <div className="card text-sm flex flex-wrap gap-x-6 gap-y-1">
        <span>
          결정 <b>{plan.count}</b>/{limit}개
        </span>
        <span>
          실수령 <b>{fmtPower(plan.worldValue)}</b>
        </span>
        <span className="text-zinc-500">정가 합 {fmtPower(plan.worldGross)}</span>
        {plan.count < limit && <span className="text-amber-700">한도 미달 {limit - plan.count}개 — 캐릭터 추가 또는 상한 상향</span>}
        {plan.idle.length > 0 && <span className="text-zinc-500">배분 0개: {plan.idle.map((id) => byId[id]?.name ?? id).join(", ")}</span>}
      </div>
      {(warnings.length > 0 || plan.warnings.length > 0) && (
        <ul className="text-xs text-amber-700 list-disc pl-5">
          {[...warnings, ...plan.warnings].map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        {w.characters.map((c) => (
          <CharacterPlanRow
            key={c.ocid}
            character={c}
            cfg={cfg.characters[c.ocid]}
            profile={profiles.find((p) => p.charId === c.ocid) ?? null}
            row={rowById[c.ocid] ?? null}
            priceDate={priceDate}
            defaultParty={defaultParty}
            tierOptions={tierOptions}
            onPatch={(p) => patchChar(c.ocid, p)}
          />
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">
        티어 기준: {tierLabel(tierOf("찬란한 흉성", "normal"))} 같은 표기는 나무위키 보스 티어. 상한 티어 이하 보스만 자동 배분됩니다. 고정 픽(📌)은 상한과 무관하게 항상 포함.
      </p>
    </div>
  );
}
