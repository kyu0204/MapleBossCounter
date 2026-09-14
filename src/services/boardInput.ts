import "server-only";
import { listPartiesForUser } from "@/lib/db/queries/parties";
import { listOwnedCharacters } from "./characterSync";
import type { PartyOption } from "@/components/board/PostForm";

/** 모집글 폼: 내가 만든 파티 옵션 (월드는 파티 값 → 없으면 연결된 멤버의 월드) */
export function partyOptionsFor(userId: string): PartyOption[] {
  return listPartiesForUser(userId)
    .filter((p) => p.isOwner)
    .map((p) => ({ id: p.id, name: p.name, boss: p.boss, difficulty: p.difficulty, world: p.world ?? p.members.find((m) => m.linkedWorld)?.linkedWorld ?? null, size: p.size }));
}

/** 모집글 폼: 내 캐릭터 월드 목록 (datalist) */
export function myWorlds(userId: string): string[] {
  return [...new Set(listOwnedCharacters(userId).map((c) => c.world).filter((w): w is string => !!w))];
}
