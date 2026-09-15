import { GRADE_COLOR, GRADE_MARK, type Grade, type Tier } from "@/lib/maple/tiers";

/**
 * 티어를 등급 이름 없이 "색이 있는 별"로만 보여준다.
 * 금(gold) > 은(silver) > 동(bronze) > 납(lead) 은 별 색으로 구분한다.
 */
export function TierStars({ tier, size = 12, compact = false, className = "" }: { tier: Tier | null | undefined; size?: number; compact?: boolean; className?: string }) {
  if (!tier) return <span className={`text-zinc-400 ${className}`} style={{ fontSize: size }}>—</span>;
  const color = GRADE_COLOR[tier.grade as Grade] ?? GRADE_COLOR.납;
  const title = `${"★".repeat(tier.stars)} (rank ${tier.rank}/32)`;
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-px font-semibold leading-none whitespace-nowrap ${className}`} style={{ color, fontSize: size }} title={title}>
        ★<span style={{ fontSize: size * 0.9 }}>{tier.stars}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex leading-none whitespace-nowrap ${className}`} style={{ color, fontSize: size, letterSpacing: "-0.04em" }} title={title} aria-label={title}>
      {"★".repeat(tier.stars)}
    </span>
  );
}

/** 색을 못 쓰는 곳(select option)용 텍스트: "🟡★★★★★" */
export function tierStarsText(tier: Tier | null | undefined): string {
  if (!tier) return "—";
  return `${GRADE_MARK[tier.grade as Grade] ?? ""}${"★".repeat(tier.stars)}`;
}
