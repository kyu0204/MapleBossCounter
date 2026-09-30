/**
 * 넥슨 공지 API(/notice-event) 응답 정리 (순수 함수).
 *
 * 응답: { event_notice: [{ title, url, notice_id, date, date_event_start, date_event_end }] }
 * 시각은 "+09:00" 문자열. 저장은 UTC ISO 로.
 */
import { parseNexonDate } from "./nexonDate";

export interface RawEventNotice {
  title?: string;
  url?: string;
  notice_id?: number;
  date?: string | null;
  date_event_start?: string | null;
  date_event_end?: string | null;
}

export interface RawEventNoticeResponse {
  event_notice?: RawEventNotice[] | null;
}

export interface EventNotice {
  noticeId: number;
  title: string;
  url: string;
  postedAt: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  isSunday: boolean;
}

/**
 * "썬데이 메이플" 공지. 매주 금요일쯤 올라오고 이벤트 기간은 그 주 일요일 하루다.
 * 표기가 조금씩 다르다 (썬데이 메이플 / 스페셜 썬데이 / 썬데이메이플).
 */
export function isSundayMaple(title: string): boolean {
  const t = title.replace(/\s+/g, "");
  return t.includes("썬데이메이플") || t.includes("스페셜썬데이") || /썬데이/.test(t);
}

export function parseEventNotices(raw: RawEventNoticeResponse | null | undefined): EventNotice[] {
  const out: EventNotice[] = [];
  for (const n of raw?.event_notice ?? []) {
    if (typeof n.notice_id !== "number" || !n.title || !n.url) continue;
    out.push({
      noticeId: n.notice_id,
      title: n.title.trim(),
      url: n.url,
      postedAt: parseNexonDate(n.date),
      eventStart: parseNexonDate(n.date_event_start),
      eventEnd: parseNexonDate(n.date_event_end),
      isSunday: isSundayMaple(n.title),
    });
  }
  return out;
}

/** 시작~종료가 [from, to] 날짜 범위(KST "YYYY-MM-DD", 포함)와 겹치는지. 종료가 없으면 시작만 본다. */
export function eventOverlaps(e: { eventStart: string | null; eventEnd: string | null }, fromDate: string, toDate: string, toKstDate: (iso: string) => string): boolean {
  const s = e.eventStart ? toKstDate(e.eventStart) : null;
  const en = e.eventEnd ? toKstDate(e.eventEnd) : s;
  if (!s) return false;
  return s <= toDate && (en ?? s) >= fromDate;
}
