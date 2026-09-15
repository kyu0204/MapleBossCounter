"use client";

import { useEffect, useRef, useState } from "react";
import { refreshVisibleSchedulers } from "@/actions/characters";

/**
 * 내 캐릭터 화면에 들어오면 스케줄러를 한 번 갱신한다.
 *
 * 서버 컴포넌트 안에서 부르면 갱신이 끝날 때까지 첫 화면이 안 뜬다. 그래서 화면을
 * 먼저 그리고 마운트 뒤에 부른다. 끝나면 서버가 /me 를 재검증해 목록이 갱신된다.
 *
 * 무엇을 몇 개나 갱신할지는 서버가 정한다 (5분 넘은 것만, 최대 12개).
 * 갱신할 것이 없으면 서버가 재검증도 하지 않으므로 다시 그리지 않는다.
 */
export function SchedulerAutoRefresh() {
  // 개발 모드의 StrictMode 이중 마운트로 두 번 나가지 않게 막는다
  const fired = useRef(false);
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setState("running");
    void refreshVisibleSchedulers()
      .then((r) => {
        setState("done");
        // 성공은 조용히 넘어간다. 화면이 이미 갱신된 값을 보여 주므로 알릴 것이 없다.
        setMsg(r.ok ? null : r.message);
      })
      .catch(() => {
        setState("done");
        setMsg("스케줄러 자동 갱신 실패");
      });
  }, []);

  if (state === "running") return <span className="text-xs text-zinc-400">보스 현황 갱신 중…</span>;
  if (msg) return <span className="text-xs text-amber-600">{msg}</span>;
  return null;
}
