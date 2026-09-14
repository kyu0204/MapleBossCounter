import Link from "next/link";
import type { ApplicantView } from "@/lib/db/queries/board";
import { fmtPower } from "@/lib/maple/format";
import { decideApplication, withdrawApplication } from "@/actions/board";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";

const STATUS_LABEL: Record<ApplicantView["status"], string> = { pending: "대기", accepted: "수락", rejected: "거절", withdrawn: "철회" };
const STATUS_STYLE: Record<ApplicantView["status"], string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  accepted: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200",
  withdrawn: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
};

/**
 * 지원자 목록. mode=author: 수락/거절 버튼 + 전투력·클리어 표시. mode=applicant: 본인 지원 + 철회.
 * 전투력·클리어는 지원한 본인이 공개에 동의한 것으로 보고 작성자에게만 노출.
 */
export function ApplicantList({ items, mode, minPower, postOpen }: { items: ApplicantView[]; mode: "author" | "applicant"; minPower: number | null; postOpen: boolean }) {
  if (!items.length) return <div className="text-sm text-zinc-500">{mode === "author" ? "아직 지원자가 없습니다." : "지원 내역이 없습니다."}</div>;
  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const c = a.character;
        const under = minPower != null && c.bestPower != null && c.bestPower < minPower;
        return (
          <li key={a.id} className={`card flex gap-3 text-sm ${a.status === "withdrawn" || a.status === "rejected" ? "opacity-60" : ""}`}>
            <CharacterAvatar src={c.imageUrl} alt={c.name} size={72} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link href={`/lookup?name=${encodeURIComponent(c.name)}`} className="font-semibold hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-zinc-500">
                  {c.world} · {c.cls} · Lv.{c.level}
                </span>
                {a.worldMismatch && <span className="badge bg-amber-100 text-amber-800">월드 다름</span>}
                <span className={`badge ml-auto ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                <span>
                  대표 전투력 <b className={under ? "text-red-600" : ""}>{fmtPower(c.bestPower)}</b>
                  {under && <span className="text-red-600"> (기준 미달)</span>}
                </span>
                {c.curPower != null && c.curPower !== c.bestPower && <span className="text-zinc-500">현재 {fmtPower(c.curPower)}</span>}
                {a.clear.snapshotDate ? (
                  <>
                    <span className={a.clear.clearedThisBoss ? "text-amber-700" : "text-green-700"}>{a.clear.clearedThisBoss ? "이번 주 이 보스 클리어함" : "이번 주 이 보스 미클리어"}</span>
                    <span className="text-zinc-500">
                      주간 {a.clear.weeklyClearCount}/{a.clear.weeklyLimit} · {a.clear.snapshotDate} 기준
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-400">이번 주 스케줄러 기록 없음</span>
                )}
              </div>
              {a.message && <div className="text-zinc-600 dark:text-zinc-400">“{a.message}”</div>}
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>
                  {a.applicantName ?? "익명"} · {a.createdAt.slice(0, 16).replace("T", " ")}
                </span>
                {mode === "author" && a.status === "pending" && postOpen && (
                  <span className="ml-auto flex gap-1">
                    <form
                      action={async () => {
                        "use server";
                        await decideApplication(a.id, "accepted");
                      }}
                    >
                      <button className="btn-primary py-0.5 text-xs">수락</button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await decideApplication(a.id, "rejected");
                      }}
                    >
                      <button className="btn-ghost py-0.5 text-xs">거절</button>
                    </form>
                  </span>
                )}
                {mode === "applicant" && (a.status === "pending" || a.status === "accepted") && (
                  <form
                    className="ml-auto"
                    action={async () => {
                      "use server";
                      await withdrawApplication(a.id);
                    }}
                  >
                    <button className="btn-ghost py-0.5 text-xs">철회</button>
                  </form>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
