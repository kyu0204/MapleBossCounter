"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { refreshCalendar } from "@/actions/calendar";

/**
 * 화면에 들어오면 한 번 조용히 갱신하고(쿨다운 안이면 아무 요청도 안 나간다),
 * 버튼은 쿨다운을 무시하고 다시 받는다.
 */
export function CalendarRefresh({ accountId }: { accountId: string }) {
  const fired = useRef<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (fired.current === accountId) return;
    fired.current = accountId;
    setAuto(true);
    void refreshCalendar(accountId, false)
      .then((r) => setMsg(r.ok ? null : r.message))
      .catch(() => setMsg("자동 갱신 실패"))
      .finally(() => setAuto(false));
  }, [accountId]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="btn-ghost text-xs py-1"
        disabled={pending || auto}
        onClick={() =>
          start(async () => {
            const r = await refreshCalendar(accountId, true);
            setMsg(r.message);
          })
        }
      >
        {pending ? "갱신 중…" : "지금 갱신"}
      </button>
      {auto && <span className="text-xs text-zinc-400">확인 중…</span>}
      {msg && <span className="text-xs text-zinc-500 truncate max-w-[16rem]">{msg}</span>}
    </span>
  );
}
