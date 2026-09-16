import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getPost } from "@/lib/db/queries/board";
import { listOwnedCharacters } from "@/services/characterSync";
import { crystalPrice } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";
import { fmtPower } from "@/lib/maple/format";
import { kstDateStr } from "@/lib/maple/kst";
import { ApplyForm } from "@/components/board/ApplyForm";
import { ApplicantList } from "@/components/board/ApplicantList";
import { remainingSlots } from "@/components/board/PostCard";
import { deletePost, setPostStatus } from "@/actions/board";

export async function generateMetadata({ params }: PageProps<"/board/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = getPost(Number(id), null);
  if (!post) return { title: "모집글" };
  return { title: `${post.title} · ${post.boss} ${post.difficulty}`, description: `${post.world ?? ""} ${post.boss} ${post.difficulty} 파티 모집 ${post.slots}명` };
}

export default async function PostPage({ params }: PageProps<"/board/[id]">) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const post = getPost(Number(id), userId);
  if (!post) notFound();

  const price = crystalPrice(post.boss, post.difficulty, kstDateStr());
  const expected = post.partySize != null ? post.partySize + post.slots : null;
  const remain = remainingSlots(post);
  const open = post.status === "open";

  const myChars = userId && !post.isAuthor ? listOwnedCharacters(userId) : [];
  const disabledIds = [
    ...post.mine.filter((a) => a.status === "pending" || a.status === "accepted").map((a) => a.characterId),
    ...(post.party?.members.map((m) => m.characterId).filter((x): x is number => x != null) ?? []),
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/board" className="text-zinc-500 hover:underline">
            ← 모집
          </Link>
          <span className={`badge ${open ? (remain === 0 ? "bg-amber-100 text-amber-800" : "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200") : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800"}`}>
            {open ? `${remain}자리 남음` : "마감"}
          </span>
          {post.world && <span className="badge bg-zinc-100 dark:bg-zinc-800">{post.world}</span>}
        </div>
        <h1 className="text-2xl font-bold">{post.title}</h1>
        <div className="text-sm text-zinc-600 dark:text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
            <BossIcon boss={post.boss} diff={post.difficulty} size={32} showDiff={false} />
            <DifficultyBadge diff={post.difficulty} size="xs" solid />
            {post.boss}
          </span>
          <TierStars tier={tierOf(post.boss, post.difficulty)} size={11} className="self-center" />
          <span>결정 {fmtPower(price)}</span>
          {expected != null && <span>{expected}인격 예상 → 1인 {fmtPower(price == null ? null : Math.floor(price / expected))}</span>}
          <span>모집 {post.slots}명 · 수락 {post.accepted}</span>
          {post.minPower != null && <span>전투력 {fmtPower(post.minPower)} 이상</span>}
          {post.scheduleNote && <span>{post.scheduleNote}</span>}
        </div>
        <div className="text-xs text-zinc-400">
          {post.authorName ?? "익명"} · {post.createdAt.slice(0, 16).replace("T", " ")}
        </div>
      </div>

      {post.body && <div className="card text-sm whitespace-pre-wrap">{post.body}</div>}

      {post.party && (
        <div className="card text-sm space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="font-semibold">현재 파티 구성원</h2>
            <span className="text-xs text-zinc-500">
              {post.party.members.length}명{post.party.name ? ` · ${post.party.name}` : ""}
            </span>
            {post.isAuthor && (
              <Link href={`/parties/${post.party.id}`} className="ml-auto text-xs underline text-zinc-500">
                파티 관리
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {post.party.members.map((m) => (
              <span key={m.id} className="badge bg-zinc-100 dark:bg-zinc-800">
                {m.nickname}
              </span>
            ))}
          </div>
        </div>
      )}

      {post.isAuthor ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">
              지원자 <span className="text-sm text-zinc-500">{post.applicants.filter((a) => a.status === "pending").length}명 대기</span>
            </h2>
            <div className="ml-auto flex gap-1">
              <Link href={`/board/${post.id}/edit`} className="btn-ghost text-xs py-1">
                수정
              </Link>
              <form
                action={async () => {
                  "use server";
                  await setPostStatus(post.id, open ? "closed" : "open");
                }}
              >
                <button className="btn-ghost text-xs py-1">{open ? "마감" : "다시 열기"}</button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deletePost(post.id);
                }}
              >
                <button className="btn-ghost text-xs py-1 text-red-600">삭제</button>
              </form>
            </div>
          </div>
          <ApplicantList items={post.applicants} mode="author" minPower={post.minPower} postOpen={open} />
          {post.party && <p className="text-xs text-zinc-500">수락하면 「{post.party.name ?? `${post.boss} ${post.difficulty}`}」 파티 구성원으로 추가되고, 수락 인원이 모집 인원에 도달하면 자동 마감됩니다.</p>}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="font-semibold">지원</h2>
          {!userId ? (
            <div className="card text-sm">
              지원하려면 로그인이 필요합니다.{" "}
              <Link href={`/login?callbackUrl=/board/${post.id}`} className="underline">
                Discord 로그인
              </Link>
            </div>
          ) : (
            <>
              {post.mine.length > 0 && <ApplicantList items={post.mine} mode="applicant" minPower={post.minPower} postOpen={open} />}
              {open ? (
                myChars.length ? (
                  <div className="card">
                    <ApplyForm postId={post.id} postWorld={post.world} characters={myChars.map((c) => ({ id: c.id, name: c.name, world: c.world, cls: c.cls, level: c.level, bestPower: c.bestPower }))} disabledIds={disabledIds} />
                  </div>
                ) : (
                  <div className="card text-sm text-zinc-600">
                    지원에는 연동된 캐릭터가 필요합니다.{" "}
                    <Link href="/settings/nexon-key" className="underline">
                      넥슨 API 키 등록
                    </Link>
                  </div>
                )
              ) : (
                <div className="card text-sm text-zinc-500">마감된 모집입니다.</div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
