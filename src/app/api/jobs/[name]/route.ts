import { NextResponse } from "next/server";
import { JOB_NAMES, runJob, type JobName } from "@/jobs/runner";
import { clientIpFrom, isLoopbackIp } from "@/lib/limiter";

/**
 * 잡 실행 엔드포인트.
 *
 * 인증: `Authorization: Bearer $JOBS_SECRET` 이 기본이다. 다만 외부 크론 서비스 중에는
 * 무료 등급에서 헤더를 못 붙이는 곳이 있어(UptimeRobot 등) `?key=$JOBS_SECRET` 도 받는다.
 * 쿼리로 보내면 비밀값이 로그·리퍼러에 남을 수 있으니, 헤더를 붙일 수 있으면 헤더를 쓸 것.
 *
 * 서버리스(Vercel)에는 루프백이 없다. 프로세스 안에서 크론을 돌릴 수 없어 외부에서
 * 때려야 하므로, 그 환경에서는 JOBS_LOOPBACK_ONLY=0 으로 두고 토큰만으로 지킨다.
 * 상시 서버(nginx 뒤)에서는 기본값 그대로 루프백만 허용하는 편이 안전하다.
 */

/** 이 라우트는 오래 걸린다. 플랫폼이 허용하는 최대치를 요청한다. */
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.JOBS_SECRET;
  if (!secret) return false;
  if ((req.headers.get("authorization") ?? "") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handle(req: Request, ctx: RouteContext<"/api/jobs/[name]">) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const loopbackOnly = process.env.NODE_ENV === "production" && process.env.JOBS_LOOPBACK_ONLY !== "0";
  if (loopbackOnly && !isLoopbackIp(clientIpFrom(req.headers))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { name } = await ctx.params;
  if (!(JOB_NAMES as readonly string[]).includes(name)) return NextResponse.json({ error: "unknown job", jobs: JOB_NAMES }, { status: 404 });
  try {
    const r = await runJob(name as JobName);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ status: "failed", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const POST = handle;
/** 크론 서비스 상당수가 GET 만 보낸다. 같은 인증을 거치므로 동작은 같다. */
export const GET = handle;
