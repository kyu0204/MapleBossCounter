/**
 * 내 캐릭터 화면 기준값. 페이지와 서버 액션이 같은 값을 봐야 해서 따로 둔다.
 * (페이지에서 export 하면 액션이 페이지 모듈을 통째로 끌어온다.)
 */

/** 이 레벨 미만 캐릭터는 기본 숨김 (?all=1 로 전체 보기). 수동 숨김(hidden)과는 별개. */
export const DASHBOARD_MIN_LEVEL = Number(process.env.DASHBOARD_MIN_LEVEL ?? 260);

/**
 * 스케줄러 자동 갱신 기준.
 *
 * 스케줄러 응답 캐시가 5분이라 그보다 자주 시도해도 어차피 캐시가 답한다.
 * 같은 값으로 맞춰 두면 화면을 다시 열어도 헛된 왕복이 없다.
 */
export const SCHEDULER_AUTO_STALE_MS = 5 * 60e3;

/**
 * 한 번에 자동 갱신할 캐릭터 수 상한.
 *
 * 캐릭터당 API 1건이고 유저 키는 하루 1,000건이다. 연동 캐릭터가 수십 개인
 * 계정에서 화면을 열 때마다 전부 긁으면 한도가 금방 바닥난다.
 * 넘치는 것은 새로고침 버튼으로 손수 갱신한다.
 */
export const SCHEDULER_AUTO_MAX = 12;
