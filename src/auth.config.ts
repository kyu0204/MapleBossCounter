import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";

/**
 * Edge(proxy.ts)에서도 import 가능한 설정. DB 어댑터는 auth.ts 에서만 붙인다.
 * 세션은 JWT — proxy 에서 DB 없이 로그인 여부 판단 가능.
 */
export const authConfig = {
  providers: [Discord({ authorization: { params: { scope: "identify" } } })],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
