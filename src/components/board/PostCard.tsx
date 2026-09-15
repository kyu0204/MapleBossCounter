import Link from "next/link";
import type { PostListItem } from "@/lib/db/queries/board";
import { crystalPrice } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";
import { fmtPower } from "@/lib/maple/format";
import { kstDateStr } from "@/lib/maple/kst";

export function remainingSlots(p: PostListItem) {
  return Math.max(0, p.slots - p.accepted);
}

export function PostCard({ post: p }: { post: PostListItem }) {
  const price = crystalPrice(p.boss, p.difficulty, kstDateStr());
  const expected = p.partySize != null ? p.partySize + p.slots : null; // 파티 연결 시 예상 최종 인원
  const remain = remainingSlots(p);
  return (
    <Link href={`/board/${p.id}`} className={`card block hover:border-orange-300 transition text-sm space-y-2 ${p.status === "closed" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <BossIcon boss={p.boss} diff={p.difficulty} size={40} showDiff={false} />
        <span className="flex flex-col gap-0.5 leading-tight min-w-0">
          <span className="flex items-center gap-1.5">
            <DifficultyBadge diff={p.difficulty} size="xs" solid />
            <span className="font-semibold truncate">{p.boss}</span>
          </span>
          <TierStars tier={tierOf(p.boss, p.difficulty)} size={10} />
        </span>
        {p.world && <span className="badge bg-zinc-100 dark:bg-zinc-800">{p.world}</span>}
        <span className={`ml-auto badge ${p.status === "closed" ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800" : remain === 0 ? "bg-amber-100 text-amber-800" : "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200"}`}>
          {p.status === "closed" ? "마감" : `${remain}자리`}
        </span>
      </div>
      <div className="font-medium truncate">{p.title}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span>모집 {p.slots}명</span>
        {expected != null && <span>{p.partySize}명 파티 → {expected}인격 예상 · 1인 {fmtPower(price == null ? null : Math.floor(price / Math.max(1, expected)))}</span>}
        {p.minPower != null && <span>전투력 {fmtPower(p.minPower)}+</span>}
        {p.scheduleNote && <span>{p.scheduleNote}</span>}
        {p.pending > 0 && <span>대기 {p.pending}</span>}
      </div>
      <div className="text-xs text-zinc-400">
        {p.authorName ?? "익명"} · {p.createdAt.slice(0, 10)}
      </div>
    </Link>
  );
}
