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

/**
 * 메소를 한 푼도 버리지 않고 읽어 준다. "12억 3456만 7890 메소"
 *
 * fmtPower 는 만 아래를 버린다 — 목록에서 줄을 맞춰 훑을 때는 그게 맞다.
 * 반면 값을 직접 입력하는 자리에서는 버리면 안 된다. 0 을 하나 더 쳤는지 덜 쳤는지
 * 확인하려고 보는 것인데 끝자리가 잘리면 그 확인이 안 된다.
 */
export function fmtMesoFull(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n === 0) return "0 메소";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.trunc(n));
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const rest = v % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man}만`);
  if (rest) parts.push(String(rest));
  return `${sign}${parts.join(" ")} 메소`;
}

/** 3자리 콤마 */
export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}
