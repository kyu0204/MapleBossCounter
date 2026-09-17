import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getOwnedPost } from "@/lib/db/queries/board";
import { kstDateStr } from "@/lib/maple/kst";
import { PostForm } from "@/components/board/PostForm";
import { myWorlds, partyOptionsFor } from "@/services/boardInput";

export const metadata = { title: "모집글 수정" };

export default async function EditPostPage({ params }: PageProps<"/board/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  const post = await getOwnedPost(Number(id), userId);
  if (!post) notFound();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">모집글 수정</h1>
      <PostForm
        parties={await partyOptionsFor(userId)}
        worlds={await myWorlds(userId)}
        today={kstDateStr()}
        initial={{
          id: post.id,
          partyId: post.partyId,
          boss: post.boss,
          difficulty: post.difficulty,
          world: post.world ?? "",
          title: post.title,
          body: post.body ?? "",
          slots: post.slots,
          minPower: post.minPower,
          scheduleNote: post.scheduleNote ?? "",
        }}
      />
    </div>
  );
}
