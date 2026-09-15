/**
 * 파티 일정 표기와 유효 기간. 요일과 시각은 각각 안 정해도 된다.
 * 주간 리셋이 목요일이라 요일 버튼도 목요일부터 늘어놓는다.
 */
import { thisWeekStartKst } from "./kst";

/** 0=일 … 6=토 */
export const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 버튼에 늘어놓는 순서: 주간 리셋(목) 기준 */
export const DAY_ORDER = [4, 5, 6, 0, 1, 2, 3] as const;

export interface PartySchedule {
  dayOfWeek: number | null;
  hour: number | null;
  minute: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "목 21:00" / "목요일" / "21:00" / null.
 * 분만 정하고 시를 안 정한 경우는 시각이 없는 것으로 본다 — 분 단독은 뜻이 없다.
 */
export function scheduleLabel({ dayOfWeek, hour, minute }: PartySchedule): string | null {
  const day = dayOfWeek != null ? DAY_LABEL[dayOfWeek] : null;
  const time = hour != null ? `${pad(hour)}:${pad(minute ?? 0)}` : null;
  if (day && time) return `${day} ${time}`;
  return day ? `${day}요일` : time;
}

/**
 * 반복이 아닌 파티는 만든 주에만 유효하다 (주간 리셋은 목 00:00 KST).
 * 지우지는 않는다 — 다시 쓰겠다면 반복으로 바꾸거나 그대로 저장하면 이번 주 파티가 된다.
 *
 * weekStart 가 없는 옛 데이터는 판정할 근거가 없으므로 살아 있는 것으로 본다.
 * 근거 없이 만료시키면 예전에 만든 파티가 조용히 사라진다.
 */
export function isPartyExpired(p: { repeats: boolean; weekStart: string | null }, now: number = Date.now()): boolean {
  if (p.repeats || !p.weekStart) return false;
  return p.weekStart < thisWeekStartKst(now);
}
