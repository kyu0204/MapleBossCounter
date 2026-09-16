"use client";

import { useState } from "react";

/**
 * maplescouter 파티 보스컷으로 보내는 버튼.
 *
 * 그 페이지는 주소에서 아무것도 읽지 않는다 (번들 확인: useSearchParams·searchParams·
 * URLSearchParams 가 한 번도 안 나오고, 파티원은 빈 배열, 보스는 검은 마법사 익스트림
 * 고정으로 시작한다. 조회도 GET 이 아니라 POST 다). 그래서 ?name= 을 붙여 봐야
 * 빈 화면이 뜬다 — 단일 조회 /result?name= 과 달리 여기는 붙일 곳이 없다.
 *
 * 대신 닉네임을 클립보드에 담고 창을 연다. 사용자는 붙여넣기만 하면 된다.
 */
const URL = "https://maplescouter.com/ko/multi-result";

/** 그 사이트가 받는 인원: 2~6명, 쉼표 구분 */
export const MULTI_MIN = 2;
export const MULTI_MAX = 6;

export function MultiResultButton({ names, className = "btn-ghost" }: { names: string[]; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const joined = names.slice(0, MULTI_MAX).join(",");
  if (names.length < MULTI_MIN) return null;

  async function go() {
    try {
      await navigator.clipboard.writeText(joined);
      setState("ok");
    } catch {
      // 권한이 없거나 http 환경이면 복사가 막힌다. 그래도 창은 열어 준다.
      setState("fail");
    }
    window.open(URL, "_blank", "noopener,noreferrer");
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={className} onClick={go} title={`닉네임(${joined})을 복사하고 maplescouter 파티 보스컷을 엽니다`}>
        환산 주스탯 한 번에 보기
      </button>
      <span className={`text-[11px] ${state === "fail" ? "text-amber-600" : "text-zinc-400"}`}>
        {state === "ok"
          ? "닉네임을 복사했습니다. 입력칸에 붙여넣으세요."
          : state === "fail"
            ? `복사가 막혔습니다. 직접 입력하세요 — ${joined}`
            : "누르면 닉네임을 쉼표로 이어 복사하고 새 창을 엽니다."}
      </span>
    </span>
  );
}
