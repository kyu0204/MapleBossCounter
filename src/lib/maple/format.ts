/** 메소/전투력 한국식 축약. 1억 5692만, 8960만, 404만, 999 */
export function fmtPower(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man}만` : `${eok}억`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`;
  return String(n);
}

export const fmtMeso = fmtPower;

/** 3자리 콤마 */
export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}
