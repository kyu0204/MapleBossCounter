import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { buildPlannerInputs, PLANNER_MIN_LEVEL } from "@/services/planInput";
import { kstDateStr } from "@/lib/maple/kst";
import { priceChangeDates } from "@/lib/maple/prices";
import { PlannerBoard } from "@/components/planner/PlannerBoard";

/**
 * 주간 결정 플래너 — 잠시 꺼 둠.
 *
 * 캐릭터가 어디까지 잡을 수 있는지(상한)를 자동으로 잡기가 어려워, 배분 결과가
 * 실제와 어긋나는 경우가 많았다. 상한 추정을 고칠 때까지 화면만 막는다.
 *
 * 코드와 저장소(plan_configs)는 그대로 둔다. 캐릭터 페이지의 "보스 설정" 이
 * 같은 저장소를 쓰고 있어서 지우면 그쪽이 깨진다.
 * 다시 켤 때는 이 상수만 true 로 바꾸면 된다.
 */
const PLANNER_ENABLED = false;

export const metadata = { title: "주간 결정 플래너" };

export default async function PlannerPage() {
  // 로그인 여부를 따지기 전에 404. 꺼 둔 기능에 로그인부터 시킬 이유가 없다.
  if (!PLANNER_ENABLED) notFound();

  const userId = await requireUserId();
  if (!await nexonKeyStatus(userId)) {
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
  const worlds = await buildPlannerInputs(userId);
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
