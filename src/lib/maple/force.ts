/**
 * 심볼 포스 (아케인포스·어센틱포스).
 *
 * 보스마다 요구하는 포스가 다르다. 아케인리버 보스는 아케인포스, 그란디스 보스는
 * 어센틱포스를 본다. 포스가 모자라면 데미지가 깎여서, 파티를 짤 때 전투력만큼이나
 * 먼저 확인하는 값이다. 그 아래 구세대 보스(자쿰·매그너스 등)는 포스와 무관하다.
 *
 * 값은 넥슨 심볼 API 의 symbol_force 합이다. 심볼 이름 앞머리로 두 종류를 가른다.
 */

export type ForceKind = "arcane" | "authentic";

export const FORCE_LABEL: Record<ForceKind, string> = {
  arcane: "아케인포스",
  authentic: "어센틱포스",
};

/** 짧은 자리용 */
export const FORCE_SHORT: Record<ForceKind, string> = {
  arcane: "아케인",
  authentic: "어센틱",
};

/**
 * 보스별로 보는 포스. 목록에 없는 보스는 포스와 무관하다 (구세대 보스, 시즌 보스).
 * 검은 마법사는 아케인리버의 끝이라 아케인포스다.
 */
const BOSS_FORCE: Record<string, ForceKind> = {
  스우: "arcane",
  데미안: "arcane",
  "가디언 엔젤 슬라임": "arcane",
  루시드: "arcane",
  윌: "arcane",
  더스크: "arcane",
  듄켈: "arcane",
  "진 힐라": "arcane",
  "검은 마법사": "arcane",
  "선택받은 세렌": "authentic",
  "감시자 칼로스": "authentic",
  "최초의 대적자": "authentic",
  카링: "authentic",
  벨로나: "authentic",
  "찬란한 흉성": "authentic",
  림보: "authentic",
  발드릭스: "authentic",
  유피테르: "authentic",
};

/** 이 보스에서 보는 포스. 없으면 null. */
export function forceKindOf(boss: string): ForceKind | null {
  return BOSS_FORCE[boss] ?? null;
}

export interface SymbolRow {
  symbol_name: string;
  symbol_force: string | number;
}

export interface Forces {
  arcane: number;
  authentic: number;
}

/**
 * 심볼 목록에서 두 포스를 합산한다.
 *
 * 이름이 "아케인심볼 : 소멸의 여로", "어센틱심볼 : 세르니움" 꼴이라 앞머리로 가른다.
 * 앞으로 다른 계열이 늘어도 모르는 이름은 그냥 버린다 — 잘못 더하면 파티에서
 * 포스가 충분한 줄 알고 들어가게 된다.
 */
export function sumForces(symbols: SymbolRow[] | null | undefined): Forces {
  const out: Forces = { arcane: 0, authentic: 0 };
  for (const s of symbols ?? []) {
    const n = Number(s.symbol_force);
    if (!Number.isFinite(n)) continue;
    if (s.symbol_name?.startsWith("아케인심볼")) out.arcane += n;
    else if (s.symbol_name?.startsWith("어센틱심볼")) out.authentic += n;
  }
  return out;
}

/** 캐릭터에 저장된 두 포스 중 이 보스에서 볼 값. */
export function forceFor(boss: string, forces: { arcaneForce: number | null; authenticForce: number | null }): { kind: ForceKind; value: number | null } | null {
  const kind = forceKindOf(boss);
  if (!kind) return null;
  return { kind, value: kind === "arcane" ? forces.arcaneForce : forces.authenticForce };
}
