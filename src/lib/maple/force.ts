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

/**
 * 보스별 요구 포스 — 데미지 100% 기준.
 *
 * 출처: 나무위키 아케인포스·어센틱포스 문서의 "보스 요구 포스" 표 (2026-09 확인).
 * 포스가 이 값에 못 미치면 주는 데미지가 깎인다. 문서에는 110·125·130·150% 칸도
 * 있지만 파티에서 보는 기준은 "깎이지 않는 최소치" 라 100% 칸만 옮긴다.
 *
 * 여러 페이즈가 적힌 보스는 마지막 페이즈 값을 쓴다 — 1페이즈만 넘겨도 잡지는 못한다.
 * 난이도로 요구치가 갈리는 보스만 byDiff 로 따로 적는다.
 *
 * 표에 없는 보스(스우·데미안·더스크·듄켈·가디언 엔젤 슬라임·벨로나·찬란한 흉성)는
 * 여기에 넣지 않는다. 짐작해서 넣으면 멀쩡한 사람이 포스 부족으로 뜬다.
 */
const FORCE_REQ: Record<string, { base: number; byDiff?: Record<string, number> }> = {
  루시드: { base: 360 },
  윌: { base: 760 },
  "진 힐라": { base: 900 },
  "검은 마법사": { base: 1320 },
  "선택받은 세렌": { base: 200 },
  "감시자 칼로스": { base: 300, byDiff: { extreme: 440 } },
  "최초의 대적자": { base: 320, byDiff: { extreme: 460 } },
  카링: { base: 330, byDiff: { extreme: 480 } },
  림보: { base: 500 },
  발드릭스: { base: 700 },
  유피테르: { base: 810 },
};

/** 이 보스·난이도에서 데미지가 깎이지 않는 최소 포스. 자료가 없으면 null. */
export function requiredForce(boss: string, diff: string): number | null {
  const r = FORCE_REQ[boss];
  if (!r) return null;
  return r.byDiff?.[diff] ?? r.base;
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
