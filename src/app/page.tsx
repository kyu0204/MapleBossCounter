import Link from "next/link";
import { auth } from "@/auth";
import { LookupForm } from "@/components/lookup/LookupForm";

export default async function Home() {
  const session = await auth();
  return (
    <div className="space-y-8">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">주간 보스, 결정 수익, 파티를 한 곳에서</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          넥슨 Open API 키를 등록하면 내 캐릭터의 전투력·스케줄러 클리어 현황을 추적하고, 월드 결정 한도 안에서 수익이 가장 높은 보스
          배분을 계산합니다.
        </p>
        <div className="flex gap-2">
          {session?.user ? (
            <Link href="/me" className="btn-primary">
              내 캐릭터 보기
            </Link>
          ) : (
            <Link href="/login" className="btn-primary">
              시작하기
            </Link>
          )}
          <Link href="/bosses/tiers" className="btn-ghost">
            보스 티어표
          </Link>
          <Link href="/board" className="btn-ghost">
            파티 모집
          </Link>
        </div>
        <div className="pt-2 space-y-1">
          <div className="text-xs text-zinc-500">로그인 없이 캐릭터 전투력 조회</div>
          <LookupForm />
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["내 캐릭터 대시보드", "대표 전투력(세팅 변경 자동 감지), 주간 보스 클리어, 결정 수익 추정"],
          ["파티 등록", "고정 파티와 인원을 등록하면 실수령(가격 ÷ 인원)이 정확해집니다"],
          ["주간 결정 플래너", "캐릭터별 12개, 월드 90개 한도 안에서 티어 기준 최적 배분"],
          ["파티 모집", "빈자리를 올리고 지원자의 전투력·이번 주 클리어 여부를 보고 수락. 파티에 자동 추가"],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h2 className="font-semibold mb-1">{t}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
