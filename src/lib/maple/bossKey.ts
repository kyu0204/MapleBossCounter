/**
 * 보스 키 표기 유틸.
 * "진 힐라 hard" 처럼 보스명(공백 허용) + 마지막 토큰이 난이도인 문자열을 다룬다.
 */

export type Difficulty = "easy" | "normal" | "hard" | "chaos" | "extreme";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "chaos", "extreme"];

export interface BossRef {
  boss: string;
  diff: Difficulty;
}

export function bossKey(boss: string, diff: string): string {
  return `${boss} ${diff}`;
}

/** "진 힐라 hard" → { boss: "진 힐라", diff: "hard" }. 형식이 틀리면 null. */
export function parseBossKey(str: string): BossRef | null {
  const s = String(str ?? "").trim();
  const cut = s.lastIndexOf(" ");
  if (cut < 0) return null;
  const boss = s.slice(0, cut).trim();
  const diff = s.slice(cut + 1) as Difficulty;
  if (!boss || !DIFFICULTIES.includes(diff)) return null;
  return { boss, diff };
}

export interface BossListEntry {
  key: string;
  party: number | null;
  raw: unknown;
}

/**
 * bosses 세 가지 표기를 [{key, party, raw}] 로 통일:
 *   배열-문자열  ["진 힐라 hard"]
 *   배열-객체    [{ boss: "진 힐라 hard", party: 2 }]
 *   객체(맵)     { "진 힐라 hard": 2 }   ← 권장. 값 = 인원
 */
export function normalizeBossList(bosses: unknown): BossListEntry[] {
  if (!bosses) return [];
  if (Array.isArray(bosses)) {
    return bosses.map((raw) => {
      if (typeof raw === "string") return { key: raw, party: null, raw };
      const o = (raw ?? {}) as { boss?: string; party?: number };
      return { key: String(o.boss ?? ""), party: o.party ?? null, raw };
    });
  }
  if (typeof bosses === "object") {
    return Object.entries(bosses as Record<string, unknown>).map(([key, party]) => ({
      key,
      party: typeof party === "number" ? party : Number(party) || null,
      raw: { [key]: party },
    }));
  }
  return [];
}
