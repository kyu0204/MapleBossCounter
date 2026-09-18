import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-5 text-sm">
        <Link href="/" className="font-bold text-orange-600 whitespace-nowrap">
          메이플 보스 카운터
        </Link>
        {/* 탭은 테두리로 하나씩 끊어 준다. 글자만 늘어놓으면 어디까지가 한 탭인지 안 보인다. */}
        <nav className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 overflow-x-auto">
          {[
            ["/bosses/tiers", "티어표"],
            ["/bosses/compare", "보상 비교"],
            ["/prices", "시세"],
            ["/board", "모집"],
            ["/lookup", "조회"],
            ...(user
              ? ([
                  ["/me", "내 캐릭터"],
                  ["/parties", "파티"],
                ] as const)
              : []),
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border border-zinc-200 px-2.5 py-1 whitespace-nowrap hover:border-orange-300 hover:text-orange-700 dark:border-zinc-700 dark:hover:border-orange-700 dark:hover:text-orange-300"
            >
              {label}
            </Link>
          ))}
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
