"use client";

import { useState, useTransition } from "react";
import { resyncCharacters } from "@/actions/characters";

export function ResyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      {msg && <span className="text-zinc-500">{msg}</span>}
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => setMsg((await resyncCharacters()).message))}>
        {pending ? "동기화 중…" : "캐릭터 목록 동기화"}
      </button>
    </span>
  );
}
