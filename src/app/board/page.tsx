import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listPosts, openPostWorlds } from "@/lib/db/queries/board";
import { PRICE_TABLE } from "@/lib/maple/prices";
import { PostCard } from "@/components/board/PostCard";

export const metadata: Metadata = {
  title: "파티 모집",
  description: "메이플스토리 주간 보스 고정 파티 구인·구직 게시판. 지원자의 전투력과 이번 주 클리어 여부를 확인하고 수락하면 파티에 자동 추가됩니다.",
};

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v.trim() : "";
}

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const sp = await searchParams;
  const boss = str(sp.boss);
  const world = str(sp.world);
  const all = sp.all === "1";
  const session = await auth();
  const list = await listPosts({ boss: boss || undefined, world: world || undefined, all });
  const worlds = await openPostWorlds();
  const bosses = Object.keys(PRICE_TABLE.prices);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">파티 모집</h1>
        <span className="text-sm text-zinc-500">{list.length}개</span>
        <div className="ml-auto flex gap-2">
          {session?.user && (
            <Link href="/board/mine" className="btn-ghost">
              내 글·지원
            </Link>
          )}
          <Link href={session?.user ? "/board/new" : "/login?callbackUrl=/board/new"} className="btn-primary">
            모집글 쓰기
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        고정 파티의 빈자리를 올리고, 지원자의 대표 전투력·이번 주 클리어 여부를 보고 수락하세요. 파티를 연결해 두면 수락 즉시 구성원에 추가되고 인원수가 결정 실수령 계산에 반영됩니다.
      </p>

      <form method="get" action="/board" className="card flex flex-wrap gap-2 items-end text-sm">
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">보스</div>
          <select name="boss" className="input" defaultValue={boss}>
            <option value="">전체</option>
            {bosses.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-500">월드</div>
          <select name="world" className="input" defaultValue={world}>
            <option value="">전체</option>
            {worlds.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-2">
          <input type="checkbox" name="all" value="1" defaultChecked={all} /> 마감 포함
        </label>
        <button className="btn-ghost">필터</button>
        {(boss || world || all) && (
          <Link href="/board" className="text-xs text-zinc-500 underline pb-2">
            초기화
          </Link>
        )}
      </form>

      {list.length === 0 ? (
        <div className="card text-sm text-zinc-500">모집글이 없습니다.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
