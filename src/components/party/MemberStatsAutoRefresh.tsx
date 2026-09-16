"use client";

import { useEffect, useRef, useState } from "react";
import { refreshPartyMemberStats } from "@/actions/parties";

/**
 * 파티 상세에 들어오면 구성원의 전투력·포스를 한 번 채운다.
 *
 * 서버 컴포넌트에서 부르면 조회가 끝날 때까지 첫 화면이 안 뜬다. 그래서 화면을
 * 먼저 그리고 마운트 뒤에 부른다. 채운 게 있으면 서버가 이 경로를 재검증한다.
 *
 * 무엇을 채울지는 서버가 정한다 (값이 없거나 6시간 지난 것만). 채울 것이 없으면
 * 요청도 재검증도 없다.
 */
export function MemberStatsAutoRefresh({ partyId }: { partyId: number }) {
  // 개발 모드 StrictMode 이중 마운트 방지
  const fired = useRef(false);
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setState("running");
    void refreshPartyMemberStats(partyId)
      .then((r) => {
        setState("done");
        setMsg(r.ok ? null : r.message);
      })
      .catch(() => {
        setState("done");
        setMsg("전투력·포스 조회 실패");
      });
  }, [partyId]);

  if (state === "running") return <span className="text-xs text-zinc-400">전투력·포스 조회 중…</span>;
  if (msg) return <span className="text-xs text-amber-600">{msg}</span>;
  return null;
}
