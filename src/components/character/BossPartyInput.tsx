"use client";

import { useState, useTransition } from "react";
import { setCharacterBossParty } from "@/actions/planner";

/**
 * 보스 한 줄의 파티 인원 입력. 바꾸면 바로 저장한다.
 *
 * 파티를 따로 등록하지 않아도 몇 인격인지 정할 수 있어야 해서, 목록의 모든 줄에 둔다.
 * 파티 등록에서 자동으로 들어온 줄(source=party)도 여기서 바꾸면 직접 고른 픽으로 굳는다 —
 * 그래야 줄마다 생김새가 같고, 사용자가 정한 값이 파티 인원 변동에 흔들리지 않는다.
 *
 * 저장은 이 키 하나만 서버에서 얹는다. 목록 전체를 보내면 여러 줄을 잇따라 고칠 때
 * 재검증 전의 오래된 목록이 앞의 변경을 덮어 버린다.
 */
export function BossPartyInput({
  ocid,
  bossKey,
  party,
  fromParty,
}: {
  ocid: string;
  bossKey: string;
  party: number;
  fromParty: boolean;
}) {
  const [value, setValue] = useState(party);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function commit(next: number) {
    const n = Math.min(6, Math.max(1, Math.round(next) || 1));
    setValue(n);
    if (n === party) return;
    start(async () => {
      const r = await setCharacterBossParty(ocid, bossKey, n);
      setErr(r.ok ? null : r.message);
      if (!r.ok) setValue(party);
    });
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" title={fromParty ? "파티 등록에서 들어온 인원입니다. 바꾸면 직접 고른 값으로 굳습니다." : "파티 인원"}>
      <input
        type="number"
        min={1}
        max={6}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onBlur={(e) => commit(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`w-12 rounded border px-1 py-0.5 text-xs text-center tabular-nums ${err ? "border-red-400" : "border-zinc-300 dark:border-zinc-700"} bg-white dark:bg-zinc-900 disabled:opacity-50`}
        aria-label={`${bossKey} 파티 인원`}
      />
      <span className="text-xs text-zinc-500">인</span>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
