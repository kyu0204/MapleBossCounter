"use client";

import { useState, useTransition } from "react";
import { setCharacterBossParty } from "@/actions/planner";
import { parseBossKey } from "@/lib/maple/bossKey";
import { clampParty, DEFAULT_MAX_PARTY, maxPartyFor } from "@/lib/maple/partySize";
import { PartySizePicker } from "@/components/boss/PartySizePicker";

/**
 * 보스 한 줄의 파티 인원 입력. 바꾸면 바로 저장한다.
 *
 * 파티를 따로 등록하지 않아도 몇 인격인지 정할 수 있어야 해서, 목록의 모든 줄에 둔다.
 *
 * 같은 보스·난이도로 파티를 등록해 뒀으면(linked) 그 파티의 구성원 수가 실제 인원이므로
 * 입력칸 대신 읽기 전용으로 보여 준다. 손으로 적은 값이 실제 파티와 어긋나면
 * 실수령이 틀리기 때문이다. 바꾸려면 파티 구성원을 고치면 된다.
 *
 * 저장은 이 키 하나만 서버에서 얹는다. 목록 전체를 보내면 여러 줄을 잇따라 고칠 때
 * 재검증 전의 오래된 목록이 앞의 변경을 덮어 버린다.
 */
export function BossPartyInput({
  ocid,
  bossKey,
  party,
  linked = false,
}: {
  ocid: string;
  bossKey: string;
  party: number;
  /** 같은 보스·난이도 파티의 실제 구성원 수를 그대로 쓰는 줄 */
  linked?: boolean;
}) {
  const [value, setValue] = useState(party);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // 보스마다 입장 인원이 다르다. 못 가는 인원으로 나누면 실수령이 통째로 틀린다.
  const parsed = parseBossKey(bossKey);
  const max = parsed ? maxPartyFor(parsed.boss, parsed.diff) : DEFAULT_MAX_PARTY;

  function commit(next: number) {
    const n = parsed ? clampParty(parsed.boss, parsed.diff, next) : Math.min(max, Math.max(1, Math.round(next) || 1));
    setValue(n);
    if (n === party) return;
    start(async () => {
      const r = await setCharacterBossParty(ocid, bossKey, n);
      setErr(r.ok ? null : r.message);
      if (!r.ok) setValue(party);
    });
  }

  if (linked) {
    return (
      <span
        className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-300"
        title="등록한 파티의 구성원 수와 연동된 인원입니다. 파티 구성원을 고치면 함께 바뀝니다."
      >
        <span className="rounded border border-orange-300 bg-orange-50 px-1 py-0.5 tabular-nums dark:border-orange-800 dark:bg-orange-950/30">{party}인</span>
        <span aria-hidden>🔗</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" title={max < DEFAULT_MAX_PARTY ? `이 보스는 최대 ${max}인` : "파티 인원 (등록한 파티가 없어 직접 정합니다)"}>
      <PartySizePicker value={value} max={max} onChange={commit} disabled={pending} compact label={`${bossKey} 파티 인원`} />
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
