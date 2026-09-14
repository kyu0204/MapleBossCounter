"use client";

import { useMemo, useState, useTransition } from "react";
import { createPost, updatePost, type PostInput } from "@/actions/board";
import { PRICE_TABLE, crystalPrice } from "@/lib/maple/prices";
import { tierLabel, tierOf } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";

export interface PartyOption {
  id: number;
  name: string | null;
  boss: string;
  difficulty: string;
  world: string | null;
  size: number;
}

export interface PostFormInitial extends PostInput {
  id?: number;
}

export function PostForm({ initial, parties, worlds, today }: { initial?: PostFormInitial; parties: PartyOption[]; worlds: string[]; today: string }) {
  const bossOptions = useMemo(() => {
    const out: { boss: string; diff: string; price: number }[] = [];
    for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
      for (const diff of Object.keys(diffs)) {
        const p = crystalPrice(boss, diff, today);
        if (p != null && tierOf(boss, diff)) out.push({ boss, diff, price: p });
      }
    }
    return out.sort((a, b) => b.price - a.price);
  }, [today]);

  const [partyId, setPartyId] = useState<number | null>(initial?.partyId ?? null);
  const [boss, setBoss] = useState(initial?.boss ?? bossOptions[0]?.boss ?? "");
  const [diff, setDiff] = useState(initial?.difficulty ?? bossOptions[0]?.diff ?? "hard");
  const [world, setWorld] = useState(initial?.world ?? worlds[0] ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [slots, setSlots] = useState(initial?.slots ?? 1);
  const [minPower, setMinPower] = useState(initial?.minPower != null ? String(Math.floor(initial.minPower / 10_000)) : "");
  const [scheduleNote, setScheduleNote] = useState(initial?.scheduleNote ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const party = parties.find((p) => p.id === partyId) ?? null;
  const diffsForBoss = bossOptions.filter((o) => o.boss === boss);
  const price = crystalPrice(boss, diff, today);
  const finalSize = (party?.size ?? 0) + slots;
  const maxSlots = party ? Math.max(1, 6 - party.size) : 5;

  function pickParty(id: number | null) {
    setPartyId(id);
    const p = parties.find((x) => x.id === id);
    if (p) {
      setBoss(p.boss);
      setDiff(p.difficulty);
      if (p.world) setWorld(p.world);
      setSlots((s) => Math.min(s, Math.max(1, 6 - p.size)));
      if (!title) setTitle(`${p.boss} ${p.difficulty} ${p.name ? `(${p.name}) ` : ""}구인`);
    }
  }

  function submit() {
    setMsg(null);
    const mp = minPower.trim() ? Math.round(Number(minPower) * 10_000) : null;
    if (mp != null && !Number.isFinite(mp)) return setMsg("전투력은 숫자(만 단위)로 입력");
    const payload: PostInput = { partyId, boss, difficulty: diff, world, title, body, slots, minPower: mp, scheduleNote };
    start(async () => {
      const r = initial?.id ? await updatePost(initial.id, payload) : await createPost(payload);
      if (r) setMsg(r.message);
    });
  }

  return (
    <div className="card space-y-4 text-sm">
      {parties.length > 0 && (
        <label className="space-y-1 block">
          <div className="text-xs text-zinc-500">연결할 고정 파티 (선택) · 수락한 지원자가 파티 구성원으로 자동 추가됩니다</div>
          <select className="input" value={partyId ?? ""} onChange={(e) => pickParty(e.target.value ? Number(e.target.value) : null)}>
            <option value="">연결 안 함 (자유 모집)</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.boss} {p.difficulty} · {p.size}인{p.name ? ` · ${p.name}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">보스</div>
          <select
            className="input"
            value={boss}
            disabled={!!party}
            onChange={(e) => {
              setBoss(e.target.value);
              const first = bossOptions.find((o) => o.boss === e.target.value);
              if (first) setDiff(first.diff);
            }}
          >
            {[...new Set(bossOptions.map((o) => o.boss))].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">난이도</div>
          <select className="input" value={diff} disabled={!!party} onChange={(e) => setDiff(e.target.value)}>
            {diffsForBoss.map((o) => (
              <option key={o.diff} value={o.diff}>
                {o.diff} · {tierLabel(tierOf(o.boss, o.diff))} · {fmtPower(o.price)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">월드</div>
          <input className="input" list="worlds" value={world} onChange={(e) => setWorld(e.target.value)} placeholder="예: 스카니아" maxLength={20} />
          <datalist id="worlds">
            {worlds.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">
            모집 인원 (최대 {maxSlots}) · 최종 {finalSize}인격 → 1인 {fmtPower(price == null ? null : Math.floor(price / Math.max(1, finalSize)))}
          </div>
          <input className="input" type="number" min={1} max={maxSlots} value={slots} onChange={(e) => setSlots(Math.min(maxSlots, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">최소 전투력 (만 단위, 선택) · 예: 15000 = 1억 5000만</div>
          <input className="input" inputMode="numeric" value={minPower} onChange={(e) => setMinPower(e.target.value)} placeholder="비우면 제한 없음" />
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">시간/요일 (선택)</div>
          <input className="input" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="예: 목 21:00 고정" maxLength={100} />
        </label>
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">제목</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 하드 세렌 딜러 1명 구합니다" maxLength={60} />
      </label>
      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">내용 (선택)</div>
        <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="진행 방식, 디스코드, 조건 등" />
      </label>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending || title.trim().length < 2} onClick={submit}>
          {pending ? "저장 중…" : initial?.id ? "수정 저장" : "모집글 올리기"}
        </button>
        {msg && <span className="text-zinc-600">{msg}</span>}
      </div>
    </div>
  );
}
