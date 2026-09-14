import Link from "next/link";
import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { buildPlannerInputs, PLANNER_MIN_LEVEL } from "@/services/planInput";
import { kstDateStr } from "@/lib/maple/kst";
import { priceChangeDates } from "@/lib/maple/prices";
import { PlannerBoard } from "@/components/planner/PlannerBoard";

export const metadata = { title: "주간 결정 플래너" };

export default async function PlannerPage() {
  const userId = await requireUserId();
  if (!nexonKeyStatus(userId)) {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-bold">주간 결정 플래너</h1>
        <p className="text-sm text-zinc-600">넥슨 API 키를 등록하고 캐릭터를 연동해야 사용할 수 있습니다.</p>
        <Link href="/settings/nexon-key" className="btn-primary w-fit">
          키 등록
        </Link>
      </div>
    );
  }
  const worlds = buildPlannerInputs(userId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">주간 결정 플래너</h1>
        <p className="text-sm text-zinc-500">
          캐릭터당 주간 보스 한도와 월드 결정 한도 안에서 실수령(가격 ÷ 인원)이 최대가 되게 배분합니다. 상한은 최근 클리어 이력의 티어로 추정하며, 파티 등록 인원은 자동 반영됩니다. Lv.{PLANNER_MIN_LEVEL} 미만은 파티·설정에 있을 때만 표시.
        </p>
      </div>
      {worlds.length === 0 ? (
        <div className="card text-sm text-zinc-500">
          연동된 캐릭터가 없습니다. <Link href="/me" className="underline">내 캐릭터</Link>에서 동기화하세요.
        </div>
      ) : (
        <PlannerBoard worlds={worlds} today={kstDateStr()} changeDates={priceChangeDates()} />
      )}
    </div>
  );
}
