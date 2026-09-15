"use client";

import { useMemo, useState, useTransition } from "react";
import { createParty, updateParty, resolveNickname, type PartyInput } from "@/actions/parties";
import { PRICE_TABLE } from "@/lib/maple/prices";
import { tierLabel, tierOf } from "@/lib/maple/tiers";
import { DIFF_LABEL } from "@/lib/maple/bossMeta";
import type { Difficulty } from "@/lib/maple/bossKey";
import { fmtPower } from "@/lib/maple/format";
import { crystalPrice } from "@/lib/maple/prices";

export interface PartyFormInitial extends PartyInput {
  id?: number;
}

type MemberState = { nick: string; status: "idle" | "checking" | "ok" | "fail"; info?: string; linked?: boolean };

export function PartyForm({ initial, myCharacters, today }: { initial?: PartyFormInitial; myCharacters: string[]; today: string }) {
  const bossOptions = useMemo(() => {
    const out: { boss: string; diff: string; price: number }[] = [];
    for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
      for (const diff of Object.keys(diffs)) {
        const t = tierOf(boss, diff);
        const p = crystalPrice(boss, diff, today);
        if (p != null && t) out.push({ boss, diff, price: p });
      }
    }
    return out.sort((a, b) => b.price - a.price);
  }, [today]);

  const [boss, setBoss] = useState(initial?.boss ?? bossOptions[0]?.boss ?? "");
  const [diff, setDiff] = useState(initial?.difficulty ?? bossOptions[0]?.diff ?? "hard");
  const [name, setName] = useState(initial?.name ?? "");
  const [scheduleNote, setScheduleNote] = useState(initial?.scheduleNote ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [members, setMembers] = useState<MemberState[]>((initial?.members ?? []).map((n) => ({ nick: n, status: "idle" })));
  const [leader, setLeader] = useState(initial?.leader ?? initial?.members?.[0] ?? "");
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const diffsForBoss = bossOptions.filter((o) => o.boss === boss);
  const price = crystalPrice(boss, diff, today);
  const size = Math.max(1, members.length);

  function addMember(nick: string) {
    const n = nick.trim();
    if (!n || members.some((m) => m.nick === n) || members.length >= 6) return;
    setMembers((ms) => [...ms, { nick: n, status: "checking" }]);
    if (!leader) setLeader(n);
    setDraft("");
    start(async () => {
      const r = await resolveNickname(n);
      setMembers((ms) => ms.map((m) => (m.nick === n ? { ...m, status: r.ok ? "ok" : "fail", info: r.ok && r.data ? `${r.data.world} · ${r.data.cls} · Lv.${r.data.level}` : r.message, linked: r.data?.linked } : m)));
    });
  }

  function submit() {
    setMsg(null);
    const payload: PartyInput = { name, boss, difficulty: diff, world: "", scheduleNote, memo, members: members.map((m) => m.nick), leader };
    start(async () => {
      const r = initial?.id ? await updateParty(initial.id, payload) : await createParty(payload);
      if (r) setMsg(r.message);
    });
  }

  return (
    <div className="card space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">보스</div>
          <select
            className="input"
            value={boss}
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
          <select className="input" value={diff} onChange={(e) => setDiff(e.target.value)}>
            {diffsForBoss.map((o) => (
              <option key={o.diff} value={o.diff}>
                {DIFF_LABEL[o.diff as Difficulty] ?? o.diff} · {tierLabel(tierOf(o.boss, o.diff))} · {fmtPower(o.price)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">파티 이름 (선택)</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 목요일 하세렌" />
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">시간/요일 메모 (선택)</div>
          <input className="input" value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="예: 목 21:00" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-zinc-500">구성원 (닉네임, 최대 6) · 현재 {size}인격 → 1인 {fmtPower(price == null ? null : Math.floor(price / size))}</div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.nick} className={`badge inline-flex items-center gap-1 ${m.status === "fail" ? "bg-red-50 text-red-700" : m.status === "ok" ? "bg-green-50 text-green-800" : "bg-zinc-100 text-zinc-700"}`} title={m.info}>
              <button type="button" onClick={() => setLeader(m.nick)} title="리더로 지정" className={leader === m.nick ? "" : "opacity-30"}>
                👑
              </button>
              {m.nick}
              {m.status === "checking" && <span className="opacity-60">…</span>}
              {m.linked && <span className="opacity-60">✓</span>}
              <button type="button" className="ml-1 opacity-60 hover:opacity-100" onClick={() => setMembers((ms) => ms.filter((x) => x.nick !== m.nick))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            list="my-characters"
            placeholder="닉네임 입력 후 Enter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMember(draft);
              }
            }}
          />
          <datalist id="my-characters">
            {myCharacters.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <button type="button" className="btn-ghost" onClick={() => addMember(draft)}>
            추가
          </button>
        </div>
        {members.some((m) => m.status === "fail") && <div className="text-xs text-red-600">확인 안 된 닉네임은 그대로 저장되지만 캐릭터 정보 연결은 안 됩니다.</div>}
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">메모 (선택)</div>
        <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending || members.length === 0} onClick={submit}>
          {pending ? "저장 중…" : initial?.id ? "수정 저장" : "파티 등록"}
        </button>
        {msg && <span className="text-zinc-600">{msg}</span>}
      </div>
    </div>
  );
}
