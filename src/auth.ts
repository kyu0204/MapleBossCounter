import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

/**
 * 로컬 개발용 로그인 (Discord 앱 없이 테스트). AUTH_DEV_LOGIN=1 이고 production 이 아닐 때만.
 * POST /api/auth/callback/dev  { csrfToken, username }
 */
const devLogin =
  process.env.AUTH_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production"
    ? [
        Credentials({
          id: "dev",
          name: "Dev",
          credentials: { username: { label: "username" } },
          async authorize(creds) {
            const username = String(creds?.username ?? "").trim() || "dev";
            const id = `dev:${username}`;
            db.insert(users).values({ id, name: username }).onConflictDoNothing().run();
            return { id, name: username };
          },
        }),
      ]
    : [];

const config: NextAuthConfig = {
  ...authConfig,
  providers: [...authConfig.providers, ...devLogin],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/** 서버 액션/서버 컴포넌트에서 로그인 유저 id. 없으면 throw. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("로그인이 필요합니다");
  return id;
}
