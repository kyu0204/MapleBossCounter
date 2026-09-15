/**
 * KST 날짜 유틸. 메이플 주간 리셋은 목요일 00:00 KST.
 * 날짜 문자열은 항상 "YYYY-MM-DD".
 */

const KST_OFFSET_MS = 9 * 3600e3;
const DAY_MS = 864e5;

/** 오늘(KST) 기준 offsetDays 만큼 이동한 날짜 문자열 */
export function kstDateStr(offsetDays = 0, now: number = Date.now()): string {
  return new Date(now + KST_OFFSET_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → 그 날짜의 요일 (0=일 … 4=목) */
export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** "YYYY-MM-DD" 에 days 더하기 */
export function addDays(dateStr: string, days: number): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 해당 날짜가 속한 주의 시작(목요일) 날짜 */
export function weekStartOf(dateStr: string): string {
  const sinceThu = (dayOfWeek(dateStr) - 4 + 7) % 7;
  return addDays(dateStr, -sinceThu);
}

/** 지난주 마지막 날(수요일). 오늘이 목요일이면 어제. */
export function lastWednesdayKst(now: number = Date.now()): string {
  return addDays(weekStartOf(kstDateStr(0, now)), -1);
}

/** 이번 주 시작(목요일) */
export function thisWeekStartKst(now: number = Date.now()): string {
  return weekStartOf(kstDateStr(0, now));
}

/**
 * DB 에 UTC ISO 로 들어 있는 시각을 KST "MM-DD HH:mm" 으로.
 * 날짜가 오늘(KST)이면 "HH:mm" 만 낸다.
 */
export function kstTimeStr(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (!Number.isFinite(t)) return null;
  const k = new Date(t + KST_OFFSET_MS).toISOString();
  return k.slice(0, 10) === kstDateStr(0, now) ? k.slice(11, 16) : `${k.slice(5, 10)} ${k.slice(11, 16)}`;
}

/** "3분 전", "2시간 전", "5일 전". 미래거나 알 수 없으면 null. */
export function agoStr(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (!Number.isFinite(t)) return null;
  const sec = Math.floor((now - t) / 1000);
  if (sec < 0) return null;
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}
