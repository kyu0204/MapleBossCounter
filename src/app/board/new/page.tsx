import { requireUserId } from "@/auth";
import { kstDateStr } from "@/lib/maple/kst";
import { myWorlds, partyOptionsFor } from "@/services/boardInput";
import { PostForm } from "@/components/board/PostForm";

export const metadata = { title: "모집글 쓰기" };

export default async function NewPostPage() {
  const userId = await requireUserId();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">모집글 쓰기</h1>
      <PostForm parties={partyOptionsFor(userId)} worlds={myWorlds(userId)} today={kstDateStr()} />
    </div>
  );
}
