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
 * 보스·난이도별 요구 포스 — 데미지 100% 기준.
 *
 * 포스가 이 값에 못 미치면 주는 데미지가 깎인다. 요구치는 난이도마다 다르다고 보고
 * 난이도 하나가 칸 하나다. 스우·데미안은 요구 포스가 없어 표에 넣지 않는다.
 *
 * **값 채우는 법** — 아는 숫자를 그 자리에 적고, 모르는 자리는 null 로 둔다.
 * null 인 칸은 화면에서 요구치와 부족 경고를 아예 내지 않는다 (포스 값만 나온다).
 * 옆 난이도 값을 옮겨 적지 말 것. 이지 윌에 하드 윌의 760 을 적으면 멀쩡한 사람이
 * 포스 부족으로 뜬다. 모르면 null 이 맞다.
 *
 * 지금 들어 있는 숫자의 출처는 나무위키 아케인포스·어센틱포스 문서의 "보스 요구 포스"
 * 표다 (2026-09 확인). 그 표는 110·125·130·150% 칸도 주지만 파티에서 보는 기준은
 * "깎이지 않는 최소치" 라 100% 칸만 옮겼다. 페이즈가 나뉜 보스는 마지막 페이즈 값이다 —
 * 1페이즈만 넘겨도 잡지는 못한다. 난이도를 안 가르고 적힌 값(세렌 200)은 그 보스의
 * 모든 난이도에 같이 넣었다.
 *
 * 난이도 칸은 결정 가격표(boss_crystal_prices.json)에 있는 난이도와 같게 맞춘다.
 */
export const FORCE_REQ: Record<string, Record<string, number | null>> = {
  // ---------- 아케인리버 (아케인포스) ----------
  "가디언 엔젤 슬라임": { normal: null, chaos: null },
  루시드: { easy: null, normal: 360, hard: 360 },
  윌: { easy: null, normal: null, hard: 760 },
  더스크: { normal: null, chaos: null },
  듄켈: { normal: null, hard: null },
  "진 힐라": { normal: null, hard: 900 },
  "검은 마법사": { hard: 1320, extreme: 1320 },

  // ---------- 그란디스 (어센틱포스) ----------
  "선택받은 세렌": { normal: 200, hard: 200, extreme: 200 },
  "감시자 칼로스": { easy: null, normal: 300, chaos: null, extreme: 440 },
  "최초의 대적자": { easy: null, normal: 320, hard: null, extreme: 460 },
  카링: { easy: null, normal: 330, hard: null, extreme: 480 },
  벨로나: { easy: null, normal: null, hard: null },
  "찬란한 흉성": { normal: null, hard: null },
  림보: { normal: 500, hard: 500 },
  발드릭스: { normal: 700, hard: 700 },
  유피테르: { normal: 810, hard: 810 },
};

/** 이 보스·난이도에서 데미지가 깎이지 않는 최소 포스. 자료가 없으면 null. */
export function requiredForce(boss: string, diff: string): number | null {
  return FORCE_REQ[boss]?.[diff] ?? null;
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
