import type { PartyWithMembers } from "@/lib/db/queries/parties";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";
import { fmtPower } from "@/lib/maple/format";
import { forceKindOf, requiredForce, FORCE_LABEL } from "@/lib/maple/force";
import { MemberStatsAutoRefresh } from "./MemberStatsAutoRefresh";

/**
 * 파티 상세의 구성원 칸. 한 사람이 한 상자, 2열.
 *
 * 파티를 짤 때 보는 값만 담는다: 초상화 · 닉네임 · 대표 전투력 · 포스.
 * 포스는 보스마다 보는 쪽이 달라서(아케인리버 → 아케인포스, 그란디스 → 어센틱포스)
 * 이 파티의 보스에 맞는 하나만 낸다. 구세대 보스는 포스가 상관없어 줄 자체를 뺀다.
 *
 * 닉네임만 적힌 미연결 멤버는 값이 없다. 0 으로 내면 약한 사람처럼 보이므로
 * 모른다고 적는다.
 */
export function PartyMemberGrid({ party: p }: { party: PartyWithMembers }) {
  const kind = forceKindOf(p.boss);
  const need = requiredForce(p.boss, p.difficulty);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-semibold">구성원 {p.size}명</h2>
        <MemberStatsAutoRefresh partyId={p.id} />
        {kind && need != null && (
          <span className="text-xs text-zinc-500" title="이 값보다 낮으면 주는 데미지가 깎입니다 (데미지 100% 기준)">
            요구 {FORCE_LABEL[kind]} <b className="tabular-nums text-zinc-700 dark:text-zinc-200">{need.toLocaleString("ko-KR")}</b>
          </span>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {p.members.map((m) => {
          const force = kind == null ? null : kind === "arcane" ? m.linkedArcane : m.linkedAuthentic;
          const short = need != null && force != null && force < need;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                m.cleared ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <CharacterAvatar src={m.linkedImage} alt="" size={72} crop="face" className={m.characterId ? "" : "opacity-50"} />
              <div className="min-w-0 flex-1 space-y-0.5 leading-tight">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{m.linkedName ?? m.nickname}</span>
                  {m.cleared && (
                    <span className="badge shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" title="이번 주 클리어">
                      클리어
                    </span>
                  )}
                </div>
                {m.characterId ? (
                  <>
                    <div className="text-xs text-zinc-500">
                      {m.linkedWorld ?? "?"} · Lv.{m.linkedLevel ?? "?"}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs">
                      <span>
                        <span className="text-zinc-500">전투력 </span>
                        <b className="tabular-nums">{m.linkedPower == null ? "—" : fmtPower(m.linkedPower)}</b>
                      </span>
                      {kind && (
                        <span title={need == null ? `${FORCE_LABEL[kind]} — ${p.boss}에서 보는 포스` : `${FORCE_LABEL[kind]} — 요구 ${need.toLocaleString("ko-KR")}`}>
                          <span className="text-zinc-500">{FORCE_LABEL[kind]} </span>
                          {/* 요구치를 아는 보스에서만 모자람을 알린다. 짐작으로 빨갛게 하면 안 된다. */}
                          <b className={`tabular-nums ${short ? "text-red-600 dark:text-red-400" : ""}`}>{force == null ? "—" : force.toLocaleString("ko-KR")}</b>
                          {need != null && <span className="text-zinc-400">/{need.toLocaleString("ko-KR")}</span>}
                          {short && <span className="ml-1 text-red-600 dark:text-red-400">{(need! - force!).toLocaleString("ko-KR")} 부족</span>}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400">캐릭터 정보 없음 (닉네임만 등록됨)</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {p.members.some((m) => m.characterId && m.linkedPower == null) && (
        <p className="text-[11px] text-zinc-400">
          전투력·포스가 &apos;—&apos; 인 캐릭터는 조회에 실패했습니다. 닉네임이 바뀌었거나 삭제된 캐릭터일 수 있습니다.
        </p>
      )}
    </div>
  );
}
