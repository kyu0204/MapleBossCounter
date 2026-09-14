import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";

// 로그인 가드. Edge 런타임: DB 어댑터 없는 authConfig 만 사용 (세션은 JWT).
const { auth } = NextAuth(authConfig);

// auth(handler) 는 NextMiddleware 를 반환. 타입 오버로드 해석이 애매해 명시적으로 지정.
const guarded: NextMiddleware = auth((req) => {
  if (req.auth?.user) return NextResponse.next();
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}) as unknown as NextMiddleware;

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  return guarded(req, event);
}

export const config = {
  // /board 목록·상세, /lookup 은 공개. 글쓰기/수정/내 글만 로그인 필요.
  matcher: ["/me/:path*", "/settings/:path*", "/parties/:path*", "/planner/:path*", "/board/new", "/board/mine", "/board/:id/edit"],
};
