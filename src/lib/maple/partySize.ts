/**
 * 보스별 최대 파티 인원.
 *
 * 인게임 입장 인원이 보스마다 다르다. 6인이 기본이지만 신규 보스 상당수가 3인이고,
 * 익스트림 스우는 2인이다. 화면에서 6인까지 고를 수 있게 두면 실제로 못 가는 인원으로
 * 실수령을 계산하게 되어 숫자가 통째로 틀린다.
 *
 * 난이도까지 봐야 하는 경우가 있어(스우는 익스트림만 2인) 보스 이름만으로 정하지 않는다.
 */

/** 인게임 기본 입장 인원 */
export const DEFAULT_MAX_PARTY = 6;

/** 난이도와 무관하게 3인이 상한인 보스 */
const MAX_THREE = new Set(["최초의 대적자", "벨로나", "찬란한 흉성", "림보", "발드릭스", "유피테르"]);

/** (보스, 난이도) 단위 예외 */
const BY_KEY: Record<string, number> = {
  "스우 extreme": 2,
};

export function maxPartyFor(boss: string, diff: string): number {
  return BY_KEY[`${boss} ${diff}`] ?? (MAX_THREE.has(boss) ? 3 : DEFAULT_MAX_PARTY);
}

/** 입력값을 그 보스가 허용하는 범위로 자른다. 1 미만은 1. */
export function clampParty(boss: string, diff: string, party: number): number {
  const max = maxPartyFor(boss, diff);
  if (!Number.isFinite(party)) return 1;
  return Math.min(max, Math.max(1, Math.round(party)));
}
