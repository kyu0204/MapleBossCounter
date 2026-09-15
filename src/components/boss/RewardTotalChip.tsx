import { ICON_BOX, type RewardTotal } from "@/lib/maple/rewards";

/**
 * 합산한 확정 보상 하나. 아이콘 + 오른쪽 아래에 겹친 개수.
 * 칸 크기는 보스 목록의 보상 칩과 같은 규격이라 나란히 놓아도 줄이 맞는다.
 */
export function RewardTotalChip({ item }: { item: RewardTotal }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
      style={{ width: ICON_BOX.w, height: ICON_BOX.h, boxSizing: "content-box" }}
      title={`${item.name} ×${item.total.toLocaleString("ko-KR")}${item.shared ? " (파티 인원으로 나눈 뒤 합한 값)" : ""}`}
    >
      {item.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.icon} alt="" width={item.w} height={item.h} style={{ width: item.w, height: item.h }} className="object-contain shrink-0" loading="lazy" decoding="async" />
      ) : (
        <span className="text-[10px] font-medium leading-none text-center px-0.5">{item.short ?? item.name}</span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-zinc-900/85 px-0.5 text-[10px] font-bold leading-[1.3] text-white tabular-nums dark:bg-zinc-100/90 dark:text-zinc-900">
        {item.total.toLocaleString("ko-KR")}
      </span>
    </span>
  );
}
