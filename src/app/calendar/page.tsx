import Link from "next/link";
import { requireUserId } from "@/auth";
import { nexonKeyStatus } from "@/lib/db/queries/nexonKeys";
import { accountGroups, buildAccountCalendar } from "@/services/calendar";
import { dayOfWeek } from "@/lib/maple/kst";
import { CalendarView } from "@/components/calendar/CalendarView";
import { CalendarRefresh } from "@/components/calendar/CalendarRefresh";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";

export const metadata = { title: "캘린더" };

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${DOW[dayOfWeek(d)]})`;

/**
 * 이번 주(목~수) 캘린더. 달 이동은 없다 — 주간 리셋이 지난 기록은 여기서 볼 일이 없고,
 * 지난주까지 그리면 "이번 주 뭐 남았나" 가 묻힌다.
 */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const userId = await requireUserId();
  const key = await nexonKeyStatus(userId);
  if (!key) {
    return (
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">캘린더</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">넥슨 API 키를 먼저 등록해야 합니다.</p>
        <Link href="/settings/nexon-key" className="btn-primary w-fit">
          키 등록하기
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const groups = await accountGroups(userId);
  if (!groups.length) {
    return (
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">캘린더</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          연동된 캐릭터가 없습니다.{" "}
          <Link href="/me" className="underline">
            내 캐릭터
          </Link>
          에서 동기화하세요.
        </p>
      </div>
    );
  }
  const wanted = typeof sp.account === "string" ? sp.account : null;
  const group = groups.find((g) => g.id === wanted) ?? groups[0];
  const model = await buildAccountCalendar(userId, group);

  const href = (acc: string) => `/calendar?account=${encodeURIComponent(acc)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">캘린더</h1>
        <span className="font-semibold tabular-nums">
          이번 주 · {md(model.weekStart)} ~ {md(model.weekEnd)}
        </span>
        <div className="ml-auto">
          <CalendarRefresh accountId={group.id} />
        </div>
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <Link
              key={g.id || "none"}
              href={href(g.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${g.id === group.id ? "border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"}`}
            >
              <span className="font-medium">{g.label}</span>
              <span className="flex -space-x-1">
                {g.characters.slice(0, 5).map((c) => (
                  <CharacterAvatar key={c.id} src={c.imageUrl} alt={c.name} size={20} crop="face" />
                ))}
              </span>
              <span className="text-xs text-zinc-500">{g.characters.length}캐릭</span>
            </Link>
          ))}
        </div>
      )}


      <CalendarView model={model} />
    </div>
  );
}
