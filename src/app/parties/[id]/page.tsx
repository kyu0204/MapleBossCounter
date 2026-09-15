import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getParty } from "@/lib/db/queries/parties";
import { listOwnedCharacters } from "@/services/characterSync";
import { kstDateStr } from "@/lib/maple/kst";
import { crystalPrice } from "@/lib/maple/prices";
import { fmtPower } from "@/lib/maple/format";
import { PartyForm } from "@/components/party/PartyForm";
import { PartyCard } from "@/components/party/PartyCard";
import { LeavePartyButton } from "@/components/party/LeavePartyButton";
import { deleteParty } from "@/actions/parties";
import type { Difficulty } from "@/lib/maple/bossKey";

export default async function PartyPage({ params }: PageProps<"/parties/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const party = getParty(Number(id), userId);
  if (!party) notFound();
  const mine = listOwnedCharacters(userId).map((c) => c.name);
  // 탈퇴 대상: 이 파티 구성원 중 내가 소유한 캐릭터로 연결된 것
  const myMembers = party.members.filter((m) => m.ownerUserId === userId).map((m) => m.linkedName ?? m.nickname);
  const price = crystalPrice(party.boss, party.difficulty, kstDateStr());
  const perPerson = price == null ? null : Math.floor(price / Math.max(1, party.size));

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">
        {party.boss} {party.difficulty} · {party.size}인격
      </h1>
      <PartyCard party={party} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-500">
          1인 실수령 <b className="text-zinc-900 dark:text-zinc-100">{fmtPower(perPerson)}</b>
        </span>
        {party.members.length >= 2 && (
          <a
            className="btn-ghost"
            href={`https://maplescouter.com/ko/multi-result?name=${encodeURIComponent(party.members.map((m) => m.linkedName ?? m.nickname).join(","))}`}
            target="_blank"
            rel="noreferrer"
            title="maplescouter 에서 구성원 환산 주스탯 한 번에 보기 (새 창)"
          >
            환산 주스탯 한 번에 보기
          </a>
        )}
      </div>
      {!party.repeats && (
        <div className="card text-sm text-amber-700 dark:text-amber-400">
          이번 주만 도는 파티입니다. 다음 목요일 00:00(KST)에 자동으로 삭제됩니다. 계속 쓰려면 수정에서 &apos;매주 반복&apos;으로 바꾸세요.
        </div>
      )}
      {party.isOwner ? (
        <>
          <PartyForm
            myCharacters={mine}
            today={kstDateStr()}
            initial={{
              id: party.id,
              name: party.name ?? "",
              boss: party.boss,
              difficulty: party.difficulty as Difficulty,
              world: party.world ?? "",
              dayOfWeek: party.dayOfWeek,
              hour: party.hour,
              minute: party.minute,
              repeats: party.repeats,
              memo: party.memo ?? "",
              members: party.members.map((m) => m.nickname),
              leader: party.members.find((m) => m.isLeader)?.nickname ?? "",
            }}
          />
          <form
            action={async () => {
              "use server";
              await deleteParty(party.id);
            }}
          >
            <button className="btn-ghost text-red-600">파티 삭제</button>
          </form>
        </>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-zinc-500">다른 유저가 만든 파티입니다. 내 캐릭터가 구성원으로 포함되어 있어 표시됩니다.</div>
          {myMembers.length > 0 && <LeavePartyButton partyId={party.id} names={myMembers} />}
        </div>
      )}
    </div>
  );
}
