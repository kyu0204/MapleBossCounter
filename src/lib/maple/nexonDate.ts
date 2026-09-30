/**
 * 넥슨 Open API 의 시각 문자열.
 *
 * 응답마다 모양이 조금씩 다르다.
 *   "2024-01-01T00:00+09:00"  (공지·이벤트, 초 없음)
 *   "2024-01-01T00:00:00+09:00"
 *   "2024-01-01T00:00"        (오프셋 없음 — KST 로 본다)
 *   "expired"                 (기간제 아이템이 이미 만료됨)
 *   null
 * 저장·비교는 전부 UTC ISO("…Z")로 통일한다. 파싱 못 하면 null.
 */
export function parseNexonDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s === "expired") return null;
  // 오프셋이 없으면 KST 로 간주한다. 넥슨 서비스 시각은 전부 KST 다.
  const withOffset = /(Z|[+-]\d\d:\d\d)$/.test(s) ? s : `${s}+09:00`;
  const t = Date.parse(withOffset);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** "expired" 문자열인지. 날짜가 아닌 만료 표시라 따로 본다. */
export function isExpiredMarker(v: unknown): boolean {
  return typeof v === "string" && v.trim() === "expired";
}

const KST_OFFSET_MS = 9 * 3600e3;

/** UTC ISO → KST 날짜 "YYYY-MM-DD" */
export function kstDateOf(iso: string): string {
  return new Date(Date.parse(iso) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC ISO → KST "HH:mm" */
export function kstClockOf(iso: string): string {
  return new Date(Date.parse(iso) + KST_OFFSET_MS).toISOString().slice(11, 16);
}
