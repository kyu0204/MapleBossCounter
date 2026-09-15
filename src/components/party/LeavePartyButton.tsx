"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { leaveParty } from "@/actions/parties";

/**
 * 파티 탈퇴 버튼. 내 캐릭터만 구성원에서 뺀다 (파티 자체는 남는다).
 *
 * 되돌리려면 만든 사람이 다시 넣어 줘야 하므로 한 번 더 묻는다.
 */
export function LeavePartyButton({ partyId, names }: { partyId: number; names: string[] }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function leave() {
    start(async () => {
      const r = await leaveParty(partyId);
      if (r.ok) router.push("/parties");
      else {
        setMsg(r.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {names.join(", ")} 을(를) 이 파티에서 뺍니다. 다시 들어가려면 만든 사람이 넣어 줘야 합니다.
          </span>
          <button className="btn-ghost text-xs" onClick={() => setConfirming(false)} disabled={pending}>
            취소
          </button>
          <button className="btn-primary text-xs" onClick={leave} disabled={pending}>
            {pending ? "나가는 중…" : "탈퇴"}
          </button>
        </>
      ) : (
        <button className="btn-ghost text-sm text-red-600" onClick={() => setConfirming(true)}>
          파티 탈퇴
        </button>
      )}
      {msg && <span className="text-sm text-red-600">{msg}</span>}
    </div>
  );
}
