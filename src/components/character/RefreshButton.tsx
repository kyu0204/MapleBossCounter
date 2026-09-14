"use client";

import { useState, useTransition } from "react";
import { refreshOne } from "@/actions/characters";

export function RefreshButton({ ocid, label = "새로고침" }: { ocid: string; label?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="btn-ghost text-xs py-1"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshOne(ocid);
            setMsg(r.message);
          })
        }
      >
        {pending ? "조회 중…" : label}
      </button>
      {msg && <span className="text-xs text-zinc-500 truncate max-w-[14rem]">{msg}</span>}
    </span>
  );
}
