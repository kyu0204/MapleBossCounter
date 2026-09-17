import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { KeyForm } from "./KeyForm";
import { deleteNexonKey } from "@/actions/nexon-key";

export const metadata = { title: "넥슨 API 키" };

export default async function NexonKeyPage() {
  const userId = await requireUserId();
  const status = await nexonKeyStatus(userId);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">넥슨 Open API 키</h1>

      {status ? (
        <div className="card space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">등록된 키</span>
            <code>****{status.keyHint}</code>
            <span className={`badge ${status.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{status.status}</span>
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            계정 {status.accountIds.length}개 · 마지막 확인 {status.lastOkAt?.slice(0, 16).replace("T", " ") ?? "-"}
          </div>
          {status.lastError && <div className="text-red-600">{status.lastError}</div>}
          <form
            action={async () => {
              "use server";
              await deleteNexonKey();
            }}
          >
            <button className="btn-ghost">키 삭제</button>
          </form>
        </div>
      ) : (
        <div className="card text-sm text-zinc-600 dark:text-zinc-400">등록된 키가 없습니다. 키를 등록하면 내 계정 캐릭터와 스케줄러(보스 클리어)를 조회할 수 있습니다.</div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold">{status ? "키 교체" : "키 등록"}</h2>
        <KeyForm />
        <ol className="text-xs text-zinc-500 list-decimal pl-5 space-y-1">
          <li>
            <a className="underline" href="https://openapi.nexon.com" target="_blank" rel="noreferrer">
              openapi.nexon.com
            </a>{" "}
            로그인 → 마이페이지 → 애플리케이션 등록 (게임: 메이플스토리)
          </li>
          <li>발급된 API Key 복사 후 위에 붙여넣기</li>
          <li>키는 서버에 암호화되어 저장되며 브라우저로 다시 전송되지 않습니다</li>
        </ol>
      </div>
    </div>
  );
}
