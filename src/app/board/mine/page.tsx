import Link from "next/link";
import { requireUserId } from "@/auth";
import { listMyApplications, listPosts } from "@/lib/db/queries/board";
import { PostCard } from "@/components/board/PostCard";

export const metadata = { title: "내 모집글·지원" };

const STATUS_LABEL = { pending: "대기", accepted: "수락됨", rejected: "거절", withdrawn: "철회" } as const;

export default async function MyBoardPage() {
  const userId = await requireUserId();
  const posts = await listPosts({ all: true, authorUserId: userId });
  const apps = await listMyApplications(userId);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">내 모집글</h1>
          <span className="text-sm text-zinc-500">{posts.length}개</span>
          <Link href="/board/new" className="btn-primary ml-auto">
            모집글 쓰기
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="card text-sm text-zinc-500">작성한 모집글이 없습니다.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">내 지원</h2>
        {apps.length === 0 ? (
          <div className="card text-sm text-zinc-500">진행 중인 지원이 없습니다.</div>
        ) : (
          <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
            {apps.map((a) => (
              <li key={a.id} className="py-2 flex flex-wrap items-baseline gap-2">
                <Link href={`/board/${a.postId}`} className="font-medium hover:underline">
                  {a.post.title}
                </Link>
                <span className="text-xs text-zinc-500">
                  {a.post.boss} {a.post.difficulty}
                  {a.post.world ? ` · ${a.post.world}` : ""}
                </span>
                <span className="text-xs text-zinc-500">{a.characterName}(으)로</span>
                <span className={`badge ml-auto ${a.status === "accepted" ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>{STATUS_LABEL[a.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
