import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobRuns } from "@/lib/db/schema";

/** pm2/nginx/uptime 체크용. DB 열림 + 최근 잡 기록 요약. */
export async function GET() {
  try {
    const last = await db.select({ jobName: jobRuns.jobName, status: jobRuns.status, startedAt: jobRuns.startedAt }).from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(5);
    return NextResponse.json({ ok: true, cron: process.env.CRON_ENABLED === "1", lastJobs: last, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
