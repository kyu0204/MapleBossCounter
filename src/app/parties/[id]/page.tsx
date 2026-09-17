import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getParty } from "@/lib/db/queries/parties";
import { listOwnedCharacters } from "@/services/characterSync";
import { kstDateStr } from "@/lib/maple/kst";
import { bossName } from "@/lib/maple/bossMeta";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { PartyForm } from "@/components/party/PartyForm";
import { PartyCard } from "@/components/party/PartyCard";
import { PartyMemberGrid } from "@/components/party/PartyMemberGrid";
import { LeavePartyButton } from "@/components/party/LeavePartyButton";
import { MultiResultButton } from "@/components/party/MultiResultButton";
import { deleteParty } from "@/actions/parties";
import type { Difficulty } from "@/lib/maple/bossKey";

export default async function PartyPage({ params }: PageProps<"/parties/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  const party = await getParty(Number(id), userId);
  if (!party) notFound();
  const mine = (await listOwnedCharacters(userId)).map((c) => c.name);
  // 탈퇴 대상: 이 파티 구성원 중 내가 소유한 캐릭터로 연결된 것
  const myMembers = party.members.filter((m) => m.ownerUserId === userId).map((m) => m.linkedName ?? m.nickname);

  return (
    <div className="max-w-2xl space-y-4">
      {/* 난이도는 목록·티어표와 같은 배지로. 인원과 1인 실수령은 바로 아래 카드에 이미 있다. */}
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <DifficultyBadge diff={party.difficulty} size="lg" solid />
        {bossName(party.boss)}
      </h1>
      <PartyCard party={party} />
      <PartyMemberGrid party={party} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <MultiResultButton names={party.members.map((m) => m.linkedName ?? m.nickname)} />
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
            // 닉네임만 넘기면 초상화가 비어 보인다. 이미 연결된 캐릭터 정보를 같이 준다.
            initialMembers={party.members.map((m) => ({
              nick: m.nickname,
              imageUrl: m.linkedImage,
              info: m.characterId ? `${m.linkedWorld ?? ""} · Lv.${m.linkedLevel ?? "?"}` : null,
            }))}
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
        myMembers.length > 0 && <LeavePartyButton partyId={party.id} names={myMembers} />
      )}
    </div>
  );
}
