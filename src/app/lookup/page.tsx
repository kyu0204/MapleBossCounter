import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { clientIpFrom } from "@/lib/limiter";
import { fmtPower } from "@/lib/maple/format";
import { lookupCharacter } from "@/services/publicLookup";
import { powerHistory } from "@/services/characterRefresh";
import { LookupForm } from "@/components/lookup/LookupForm";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";

function nameOf(sp: Record<string, string | string[] | undefined>) {
  return typeof sp.name === "string" ? sp.name.trim() : "";
}

export async function generateMetadata({ searchParams }: PageProps<"/lookup">): Promise<Metadata> {
  const name = nameOf(await searchParams);
  return name
    ? { title: `${name} 전투력 조회`, description: `메이플스토리 ${name} 캐릭터의 전투력·레벨·직업 조회` }
    : { title: "캐릭터 조회", description: "메이플스토리 캐릭터 닉네임으로 전투력·레벨·직업을 조회합니다." };
}

export default async function LookupPage({ searchParams }: PageProps<"/lookup">) {
  const name = nameOf(await searchParams);
  const session = await auth();
  const result = name ? await lookupCharacter(name, { userId: session?.user?.id ?? null, ip: clientIpFrom(await headers()) }) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">캐릭터 조회</h1>
        <p className="text-sm text-zinc-500">닉네임으로 전투력(넥슨 Open API 공개 데이터)을 조회합니다. 같은 캐릭터는 10분에 한 번만 새로 받아옵니다.</p>
      </div>
      <LookupForm defaultValue={name} />

      {result?.status === "invalid" && <div className="card text-sm text-red-600">닉네임은 한글·영문·숫자 2~12자입니다.</div>}
      {result?.status === "limited" && <div className="card text-sm text-amber-700">조회가 너무 잦습니다. {result.retryAfterSec}초 후 다시 시도하세요.</div>}
      {result?.status === "notfound" && <div className="card text-sm text-zinc-600">「{name}」 캐릭터를 찾을 수 없습니다. 닉네임을 확인하거나 잠시 후 다시 시도하세요.</div>}

      {result?.status === "ok" && (() => {
        const c = result.character;
        const history = powerHistory(c.id, 10).slice().reverse();
        const wearingBest = c.bestSetupHash != null && c.curSetupHashes?.equipped === c.bestSetupHash;
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="card flex gap-4">
              <CharacterAvatar src={c.imageUrl} alt={c.name} size={128} />
              <div className="space-y-1 text-sm min-w-0">
                <h2 className="text-xl font-bold">
                  {c.name} <span className="text-base font-normal text-zinc-500">{c.world} · {c.cls} · Lv.{c.level}</span>
                </h2>
                <div>
                  대표 전투력 <b>{fmtPower(c.bestPower)}</b>
                  {c.bestPowerAt && <span className="text-zinc-500"> ({c.bestPowerAt.slice(0, 10)} 기준)</span>}
                </div>
                <div>
                  현재 {fmtPower(c.curPower)}
                  {c.curPowerAt && <span className="text-zinc-500"> · {c.curPowerAt.slice(0, 16).replace("T", " ")} UTC</span>}
                  {!wearingBest && c.curPower != null && c.bestPower != null && <span className="ml-1 badge bg-amber-100 text-amber-800">대표값과 다른 세팅</span>}
                </div>
                <div className="text-xs text-zinc-500">
                  {result.refreshed ? "방금 갱신" : "캐시 값"}
                  {result.note && ` · ${result.note}`}
                  {c.ownerUserId && " · 이 사이트 유저의 캐릭터"}
                </div>
                <div className="flex gap-3 pt-1 text-xs">
                  <a className="underline text-zinc-500" href={`https://maplescouter.com/ko/result?name=${encodeURIComponent(c.name)}`} target="_blank" rel="noreferrer">
                    maplescouter
                  </a>
                  <Link className="underline text-zinc-500" href={`/board?world=${encodeURIComponent(c.world ?? "")}`}>
                    {c.world} 모집글 보기
                  </Link>
                </div>
              </div>
            </div>
            <div className="card text-sm">
              <h3 className="font-semibold mb-2">전투력 이력</h3>
              {history.length ? (
                <ul className="space-y-0.5 text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span className="text-zinc-500">{h.measuredAt.slice(0, 16).replace("T", " ")}</span>
                      <span>{fmtPower(h.power)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-zinc-500 text-xs">기록 없음</div>
              )}
              <p className="text-[11px] text-zinc-400 mt-2">대표 전투력은 관측된 최대값. 장비 세팅이 바뀌면 최대값을 다시 잡습니다.</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
