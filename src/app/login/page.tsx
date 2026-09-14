import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/me");
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/me";
  return (
    <div className="max-w-sm mx-auto card space-y-4 mt-10">
      <h1 className="text-xl font-bold">로그인</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Discord 계정으로 로그인합니다. 서버 정보는 요청하지 않고 프로필(identify)만 사용합니다.</p>
      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: callbackUrl });
        }}
      >
        <button className="btn-primary w-full justify-center">Discord로 계속</button>
      </form>
    </div>
  );
}
