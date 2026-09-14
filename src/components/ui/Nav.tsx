import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-5 text-sm">
        <Link href="/" className="font-bold text-orange-600">
          메이플 파티 보드
        </Link>
        <nav className="flex items-center gap-4 text-zinc-600 dark:text-zinc-300">
          <Link href="/bosses/tiers">티어표</Link>
          <Link href="/bosses/crystals">결정 가격</Link>
          <Link href="/board">모집</Link>
          <Link href="/lookup">조회</Link>
          {user && (
            <>
              <Link href="/me">내 캐릭터</Link>
              <Link href="/parties">파티</Link>
              <Link href="/planner">플래너</Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Link href="/settings/nexon-key" className="text-zinc-600 dark:text-zinc-300">
                설정
              </Link>
              <span className="text-zinc-500">{user.name}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="btn-ghost">로그아웃</button>
              </form>
            </>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/me" });
              }}
            >
              <button className="btn-primary">Discord 로그인</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
