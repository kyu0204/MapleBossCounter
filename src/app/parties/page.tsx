import Link from "next/link";
import { requireUserId } from "@/auth";
import { listPartiesForUser } from "@/lib/db/queries/parties";
import { purgeExpiredOneOffParties } from "@/services/partyCleanup";
import { PartyCard } from "@/components/party/PartyCard";

export const metadata = { title: "파티" };

export default async function PartiesPage() {
  const userId = await requireUserId();
  // 크론이 꺼진 환경에서도 지난 "이번 주만" 파티가 남아 있지 않게 한 번 더 정리한다
  purgeExpiredOneOffParties();
  const list = await listPartiesForUser(userId);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">고정 파티</h1>
        <span className="text-sm text-zinc-500">{list.length}개</span>
        <Link href="/parties/new" className="btn-primary ml-auto">
          파티 등록
        </Link>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        매주 같이 도는 보스와 구성원을 등록하면 인원수가 실수령(가격 ÷ 인원) 계산에 자동 반영됩니다. 구성원은 닉네임만 적어도 되고, 이 사이트 유저의 캐릭터면 자동 연결됩니다.
      </p>
      {list.length === 0 ? (
        <div className="card text-sm text-zinc-500">등록된 파티가 없습니다.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <PartyCard key={p.id} party={p} />
          ))}
        </div>
      )}
    </div>
  );
}
