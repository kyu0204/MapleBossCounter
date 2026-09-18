import type { Metadata } from "next";
import Link from "next/link";
import { allBoxContentNames } from "@/lib/maple/boxes";
import { allPrices, extraPrices, noMarketItems, PRICE_META, type PriceRow } from "@/lib/maple/itemPrices";
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
              <td className="py-1.5 pr-2">{name}</td>
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

export default function PricesPage() {
  const boxContents = new Set(allBoxContentNames());
  const rows = allPrices().sort((a, b) => b[1].meso - a[1].meso);
  // 보스가 직접 주는 것과, 상자를 까야 나오는 것을 나눈다. 성격이 달라 같이 두면 헷갈린다.
  const reward = rows.filter(([n]) => !boxContents.has(n));
  const contents = rows.filter(([n]) => boxContents.has(n));
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">보스 보상 {reward.length}종</h2>
        <Table rows={reward} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">상자 구성품 {contents.length}종</h2>
        <p className="text-xs text-zinc-500">
          상자 자체는 거래가 안 돼 시세가 없습니다. 골라 꺼내는 상자(에테르넬 방어구 상자)는 구성품 중 가장 비싼 값을 상자 값으로 쓰고, 무엇이 나올지 못 고르는 상자(칠흑 장신구 상자·보스 반지 상자)는 값을 세우지 않고 구성만
          보여 줍니다.
        </p>
        <Table rows={contents} />
      </section>

      {none.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">시세 없음 {none.length}종</h2>
          <p className="text-xs text-zinc-500">거래 기록이 없어 값을 못 매긴 것입니다 (거래 불가이거나 아무도 안 내놓은 것). 괄호는 마지막으로 확인한 날입니다.</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {none.map(([name, at]) => (
              <li key={name}>
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
