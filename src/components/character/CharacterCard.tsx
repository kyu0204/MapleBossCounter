import Link from "next/link";
import type { Character } from "@/lib/db/schema";
import type { ParsedSnapshot } from "@/lib/maple/scheduler";
import { fmtPower } from "@/lib/maple/format";
import { CharacterAvatar } from "./CharacterAvatar";


/**
 * 목록의 캐릭터 카드. 카드 전체가 상세로 가는 링크다.
 *
 * 새로고침은 상세에, 숨기기는 목록 위 설정에 모았다. 카드에 버튼을 두면
 * 카드를 통째로 누르는 동작과 부딪히고, 카드 12개마다 버튼이 붙어 시끄럽다.
 */
export function CharacterCard({
  character: c,
  snapshot,
  revenue,
}: {
  character: Character;
  snapshot: ParsedSnapshot | null;
  /** 고른 보스를 다 돌았을 때의 실수령 합. 고른 보스가 없으면 null */
  revenue: number | null;
}) {
  return (
    <Link
      href={`/me/characters/${c.ocid}`}
      className={`card flex gap-4 transition hover:border-orange-300 dark:hover:border-orange-800 ${c.hidden ? "opacity-50" : ""}`}
    >
      <CharacterAvatar src={c.imageUrl} alt={c.name} size={112} />
      <div className="flex-1 min-w-0 text-sm space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-base truncate">{c.name}</span>
          <span className="text-xs text-zinc-500 truncate">
            {c.cls} · Lv.{c.level}
          </span>
        </div>
        {/* 대표 전투력 하나만. 현재 전투력과 세팅 경고는 캐릭터 상세에 있다. */}
        <div>
          <span className="text-zinc-500">대표 전투력 </span>
          <span className="font-semibold text-base">{fmtPower(c.bestPower)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>주간 보스 {snapshot ? `${snapshot.weeklyClearCount}/${snapshot.weeklyLimit}` : "-"}</span>
          {c.hidden && <span className="text-zinc-400">숨김</span>}
        </div>
        {revenue != null && revenue > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">총 수익</span>
            <b className="tabular-nums">{fmtPower(revenue)}</b>
          </div>
        )}
      </div>
    </Link>
  );
}
