/** GET 폼: 클라이언트 JS 없이 /lookup?name= 으로 이동 */
export function LookupForm({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  return (
    <form action="/lookup" method="get" className={`flex gap-2 ${compact ? "" : "max-w-md"}`}>
      <input name="name" className="input" placeholder="캐릭터 닉네임" defaultValue={defaultValue} maxLength={12} autoComplete="off" required />
      <button className="btn-primary shrink-0">조회</button>
    </form>
  );
}
