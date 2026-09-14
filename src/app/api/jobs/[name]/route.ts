import { NextResponse } from "next/server";
import { JOB_NAMES, runJob, type JobName } from "@/jobs/runner";
import { clientIpFrom, isLoopbackIp } from "@/lib/limiter";

/**
 * 수동 잡 실행. Authorization: Bearer $JOBS_SECRET.
 * production 에서는 기본으로 루프백(127.0.0.1)에서 온 요청만 허용 (nginx 가 X-Real-IP 를 붙인다는 전제).
 * 외부에서 호출해야 하면 JOBS_LOOPBACK_ONLY=0. nginx 단에서도 /api/jobs/ 를 allow 127.0.0.1; deny all; 로 막아둔다.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/jobs/[name]">) {
  const secret = process.env.JOBS_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
