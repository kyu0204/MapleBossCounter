import type { Metadata } from "next";
import Link from "next/link";
import { ETERNEL_PARTS, eternelPartOf } from "@/lib/maple/boxes";
import { allPrices, extraPrices, noMarketItems, PRICE_META, type PriceRow } from "@/lib/maple/itemPrices";
import { groupByPriceGroup } from "@/lib/maple/priceGroups";
import { iconOf } from "@/lib/maple/itemIcons";
import { ICON_BOX } from "@/lib/maple/rewards";
import { fmtPower } from "@/lib/maple/format";

export const metadata: Metadata = {
  title: "아이템 시세",
  description: "보스 보상과 상자 구성품의 현재 시세. 하루 한 번 받아 갱신합니다.",
};

/** 저장된 ISO 시각을 KST 날짜·시각으로. 서버에서 렌더하므로 TZ 를 명시한다. */
function kstStamp(iso: string | null): string {
  if (!iso) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * 아이콘 칸. 원본 크기가 28x28 부터 39x38 까지 제각각이라 줄이지 않고
 * 같은 칸 안에 가운데 정렬해서 줄만 맞춘다. 아이콘이 없으면 칸만 비워 둔다.
 */
function ItemIconCell({ name }: { name: string }) {
  const icon = iconOf(name);
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: ICON_BOX.w, height: ICON_BOX.h }}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon.src} alt="" width={icon.w} height={icon.h} style={{ width: icon.w, height: icon.h }} className="object-contain" loading="lazy" decoding="async" />
      ) : null}
    </span>
  );
}

function Table({ rows }: { rows: [string, PriceRow][] }) {
  if (!rows.length) return <p className="text-sm text-zinc-400">없습니다.</p>;
  return (
    // 좁은 화면에서는 가로로 민다. 값을 줄바꿈하면 자릿수가 안 읽힌다.
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-zinc-500">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left font-medium py-1.5">아이템</th>
            <th className="text-right font-medium py-1.5">현재가</th>
            <th className="text-right font-medium py-1.5 whitespace-nowrap">메소</th>
            <th className="text-right font-medium py-1.5 whitespace-nowrap">기준일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, row]) => (
            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-2">
                  <ItemIconCell name={name} />
                  {name}
                </span>
              </td>
              <td className="py-1.5 text-right font-medium tabular-nums whitespace-nowrap">{fmtPower(row.meso)}</td>
              <td className="py-1.5 text-right text-xs text-zinc-400 tabular-nums whitespace-nowrap">{row.meso.toLocaleString("ko-KR")}</td>
              <td className="py-1.5 text-right text-xs text-zinc-400 whitespace-nowrap">{row.quotedOn ?? "메인 시세표"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 에테르넬 35종을 부위로 나눈다.
 *
 * 값 순으로 늘어놓으면 장갑·신발·망토(15억대)가 위에 몰리고 나머지가 아래에 깔려,
 * 같은 부위끼리 직업군 값을 견주기가 어렵다. 부위로 끊으면 다섯 줄씩 맞대 볼 수 있다.
 */
function eternelByPart(rows: [string, PriceRow][]): [string, [string, PriceRow][]][] {
  const out: [string, [string, PriceRow][]][] = [];
  for (const part of ETERNEL_PARTS) {
    const list = rows.filter(([n]) => eternelPartOf(n)?.part === part);
    if (list.length) out.push([part, list]);
  }
  return out;
}

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ 정렬?: string }> }) {
  // 정렬은 주소에 담는다. 서버에서 그리는 화면이라 클릭 한 번에 다시 받는 편이 단순하고,
  // 링크를 그대로 남길 수도 있다.
  const byPart = (await searchParams).정렬 === "부위";

  const rows = allPrices().sort((a, b) => b[1].meso - a[1].meso);
  // 세트끼리 붙여 놓는다. 값 순으로만 늘어놓으면 칠흑과 에테르넬이 뒤섞여 무엇을 보는지 놓친다.
  const groups = groupByPriceGroup<[string, PriceRow]>(rows, ([name]) => name);
  const extra = extraPrices().sort((a, b) => b[1].meso - a[1].meso);
  const none = noMarketItems().sort((a, b) => a[0].localeCompare(b[0], "ko"));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">아이템 시세</h1>
        <p className="text-sm text-zinc-500">
          보스 보상과 상자 구성품의 현재가입니다. 하루 한 번 받아 둔 값이라 지금 경매장과 다를 수 있습니다.{" "}
          <Link href="/bosses/compare" className="underline">
            보상 비교
          </Link>
          에서 이 값을 씁니다. 직접 넣은 값이 있으면 그쪽이 이깁니다.
        </p>
        <p className="text-[11px] text-zinc-400">
          갱신 {kstStamp(PRICE_META.updated)} · {PRICE_META.source} · 시세 {rows.length}종
        </p>
      </div>

      {groups.map(([g, list]) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-sm font-semibold flex items-baseline gap-2">
            <span>
              {g.label} <span className="font-normal text-zinc-400">{list.length}종</span>
            </span>
            {g.key === "에테르넬" && (
              <span className="font-normal text-xs text-zinc-400">
                <Link href="/prices" className={byPart ? "underline" : "text-zinc-700 dark:text-zinc-200"} scroll={false}>
                  값순
                </Link>
                {" · "}
                <Link href="/prices?정렬=부위" className={byPart ? "text-zinc-700 dark:text-zinc-200" : "underline"} scroll={false}>
                  부위순
                </Link>
              </span>
            )}
          </h2>
          {g.key === "에테르넬" && byPart ? (
            eternelByPart(list).map(([part, sub]) => (
              <div key={part} className="space-y-1">
                <h3 className="text-xs font-medium text-zinc-500">{part}</h3>
                <Table rows={sub} />
              </div>
            ))
          ) : (
            <Table rows={list} />
          )}
        </section>
      ))}

      {none.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">시세 없음 {none.length}종</h2>
          <p className="text-xs text-zinc-500">거래 기록이 없어 값을 못 매긴 것입니다 (거래 불가이거나 아무도 안 내놓은 것). 괄호는 마지막으로 확인한 날입니다.</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {none.map(([name, at]) => (
              <li key={name} className="flex items-center gap-1">
                <ItemIconCell name={name} />
                {name} <span className="text-zinc-400">({at})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extra.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">참고로 받아 둔 것 {extra.length}종</h2>
          <p className="text-xs text-zinc-500">보스 보상이 아니라 계산에는 안 씁니다.</p>
          <Table rows={extra} />
        </section>
      )}
    </div>
  );
}
