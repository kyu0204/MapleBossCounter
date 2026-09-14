/** 공개 URL. 배포 시 AUTH_URL(예: https://example.com) 설정. 로컬은 localhost. */
export function siteUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
