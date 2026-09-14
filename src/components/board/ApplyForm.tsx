"use client";

import { useState, useTransition } from "react";
import { applyToPost } from "@/actions/board";
import { fmtPower } from "@/lib/maple/format";

export interface ApplyCharacter {
  id: number;
  name: string;
  world: string | null;
  cls: string | null;
  level: number | null;
  bestPower: number | null;
}

export function ApplyForm({ postId, postWorld, characters, disabledIds }: { postId: number; postWorld: string | null; characters: ApplyCharacter[]; disabledIds: number[] }) {
  const available = characters.filter((c) => !disabledIds.includes(c.id));
  const sameWorld = available.filter((c) => !postWorld || c.world === postWorld);
  const [characterId, setCharacterId] = useState<number | null>(sameWorld[0]?.id ?? available[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const picked = available.find((c) => c.id === characterId);

  if (!available.length) return <div className="text-sm text-zinc-500">지원 가능한 캐릭터가 없습니다. (모든 캐릭터가 이미 지원했거나 연동된 캐릭터가 없음)</div>;

  return (
    <div className="space-y-3 text-sm">
      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">지원 캐릭터 · 작성자에게 대표 전투력과 이번 주 클리어 여부가 보입니다</div>
        <select className="input" value={characterId ?? ""} onChange={(e) => setCharacterId(Number(e.target.value))}>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.world} · {c.cls} Lv.{c.level} · {fmtPower(c.bestPower)}
              {postWorld && c.world !== postWorld ? " · 월드 다름" : ""}
            </option>
          ))}
        </select>
      </label>
      {picked && postWorld && picked.world !== postWorld && <div className="text-xs text-amber-700">모집 월드({postWorld})와 다른 월드의 캐릭터입니다.</div>}
      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">한마디 (선택)</div>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="가능 시간, 딜 포지션 등" />
      </label>
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={pending || !characterId}
          onClick={() =>
            start(async () => {
              const r = await applyToPost(postId, { characterId: characterId!, message });
              setMsg(r.message);
            })
          }
        >
          {pending ? "지원 중…" : "지원하기"}
        </button>
        {msg && <span className="text-zinc-600">{msg}</span>}
      </div>
    </div>
  );
}
