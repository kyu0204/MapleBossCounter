"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRow, DROP_META, itemsIn, summarize, type ItemValues, type RewardLine } from "@/lib/maple/compare";
import { bossName } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { ICON_BOX } from "@/lib/maple/rewards";
import type { Difficulty } from "@/lib/maple/bossKey";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { BossPickerModal } from "@/components/party/BossPickerModal";
import { clampParty, maxPartyFor } from "@/lib/maple/partySize";
import { PartySizePicker } from "./PartySizePicker";
import { ItemValueModal } from "./ItemValueModal";

/**
 * 보스 둘의 결과를 위아래로 쌓아 보여 준다.
 *
 * 좌우로 나란히 놓으면 칸이 좁아 보상 이름이 잘리고, 한 줄에 맞추는 표는 보상 종류가
 * 달라 빈칸이 많았다. 각 보스의 결과를 통째로 한 덩어리로 읽고, 결론은 맨 아래에서
 * 한 번에 낸다.
 *
 * 인원은 양쪽 따로 잡는다. "하드 세렌 2인" 과 "노말 카링 솔로" 처럼 조건이 다른 둘을
 * 견주는 것이 이 화면의 쓸모다.
 *
 * 아이템 값어치는 시세라 코드에 박지 않는다. 화면에서 받아 이 브라우저에만 둔다.
 */
const VALUES_KEY = "maple-item-values";
const SIDES_KEY = "maple-compare-sides";
const DROP_KEY = "maple-drop-rate";
const USE_CHANCE_KEY = "maple-use-chance";

interface Side {
  boss: string;
  diff: string;
  party: number;
}

const DEFAULT_SIDES: [Side, Side] = [
  { boss: "선택받은 세렌", diff: "hard", party: 1 },
  { boss: "카링", diff: "normal", party: 1 },
];

/**
 * 두 칸을 색으로 가른다.
 *
 * "1번/2번" 글자를 빼는 대신 색이 그 자리를 대신한다. 결과 칸의 보상 차이도 같은 색을
 * 쓰므로 어느 보스 몫인지 글자를 읽지 않고 알 수 있다.
 *
 * 색은 오직 편 구분에만 쓴다. 이긴 쪽은 색이 아니라 배지와 굵기로 가른다 —
 * 승패까지 색으로 칠하면 "주황이 편 색인가 이겼다는 뜻인가" 가 헷갈린다.
 */
const SIDE_TONE = [
  {
    bar: "border-l-sky-400 dark:border-l-sky-600",
    text: "text-sky-700 dark:text-sky-400",
    dot: "bg-sky-400",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  {
    bar: "border-l-orange-400 dark:border-l-orange-600",
    text: "text-orange-700 dark:text-orange-400",
    dot: "bg-orange-400",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  },
] as const;

/**
 * 보상 줄 정렬. 값을 매긴 것이 큰 것부터 위, 값을 안 매긴 것은 그 아래 이름순.
 *
 * 값 없는 줄도 지우지 않는다. 그 보스가 무엇을 주는지가 곧 비교 근거이고,
 * 안 보이면 값을 넣을 생각조차 못 한다.
 */
const ordered = (lines: RewardLine[]) =>
  [...lines].sort((a, b) => Number(a.unpriced) - Number(b.unpriced) || b.value - a.value || a.name.localeCompare(b.name, "ko"));

/** 아이콘 칸. 아이콘이 없으면 짧은 글자 라벨로 대신한다. */
function Icon({ icon, w, h, short, name }: { icon?: string; w?: number; h?: number; short?: string; name: string }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: ICON_BOX.w, height: ICON_BOX.h }}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" width={w} height={h} style={{ width: w, height: h }} className="object-contain" loading="lazy" decoding="async" />
      ) : (
        <span className="text-[10px] leading-none text-center">{short ?? name}</span>
      )}
    </span>
  );
}

/**
 * 보상 줄. 아이콘 + 이름 + 근거 + 값.
 *
 * 값을 안 매긴 줄은 흐리게 두고 값 자리에 "값 없음" 을 적는다. 0 원으로 적으면
 * 정말 가치가 없는 것처럼 읽힌다 — 모르는 것과 0 은 다르다.
 */
function Lines({ lines, empty, showUnit, counts }: { lines: RewardLine[]; empty: string; showUnit?: boolean; counts?: boolean }) {
  if (!lines.length) return <div className="text-xs text-zinc-400">{empty}</div>;
  return (
    // 아이콘·수량·값을 바짝 붙인다. 사이를 늘리면 어느 값이 어느 아이콘 것인지 눈이 헤맨다.
    <ul className="grid gap-x-3 gap-y-1 grid-cols-2">
      {lines.map((l) => (
        <li key={l.name} className={`flex items-center gap-1 ${l.unpriced ? "opacity-60" : ""}`} title={l.name}>
          <Icon icon={l.icon} w={l.w} h={l.h} short={l.short} name={l.name} />
          {/* 이름은 아이콘과 마우스 오버로 알아본다. 화면에서만 감추고 읽어 주는 데는 남긴다. */}
          <span className="sr-only">{l.name}</span>
          {/* 근거: 확정은 수량, 랜덤은 확률(과 표본 수) */}
          <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">
            {counts
              ? "" // 확정은 오른쪽 칸이 곧 개수라 여기 또 적지 않는다
              : l.chance != null
                ? `${l.chance.toFixed(2)}%${l.chanceFrom === "stats" && l.kills ? ` · ${l.kills >= 1000 ? `${Math.round(l.kills / 1000)}천` : l.kills}회` : ""}`
                : ""}
          </span>
          <span className="text-xs tabular-nums shrink-0">
            {counts ? (
              // 확정은 개수로 견준다. 조각은 본품 환산도 같이 (5조각 = 2.5개)
              <b>
                {l.amountText}
                {l.baseName && l.baseName !== l.name ? <span className="font-normal text-[10px] text-zinc-400"> ≈{l.baseAmount}</span> : null}
              </b>
            ) : l.unpriced ? (
              <span className="text-[11px] text-zinc-400">값 없음</span>
            ) : showUnit ? (
              // 확률 보정을 끈 랜덤 줄: 기대값이 아니라 단가다. 합계에 안 들어간다.
              <span className="text-zinc-600 dark:text-zinc-300">{fmtPower(l.unitPrice ?? 0)}</span>
            ) : (
              <b>{fmtPower(l.value)}</b>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BossCompare({ today }: { today: string }) {
  const [values, setValues] = useState<ItemValues>({});
  const [sides, setSides] = useState<[Side, Side]>(DEFAULT_SIDES);
  const [dropRate, setDropRate] = useState(0);
  const [useChance, setUseChance] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // 첫 렌더는 서버와 같아야 하므로 저장값은 마운트 뒤에 읽는다
  useEffect(() => {
    try {
      const v = localStorage.getItem(VALUES_KEY);
      if (v) setValues(JSON.parse(v) as ItemValues);
      const s = localStorage.getItem(SIDES_KEY);
      if (s) {
        const parsed = JSON.parse(s) as Side[];
        if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((x) => x?.boss && x?.diff)) setSides([parsed[0], parsed[1]]);
      }
      const d = Number(localStorage.getItem(DROP_KEY));
      if (Number.isFinite(d) && d >= 0) setDropRate(d);
      // 저장된 적이 없으면 켠 상태로 둔다 (통계가 있으니 기본은 보정 쓰는 쪽)
      if (localStorage.getItem(USE_CHANCE_KEY) === "0") setUseChance(false);
    } catch {
      // 사생활 보호 모드 등에서 막힐 수 있다. 값 없이 그냥 쓴다.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(VALUES_KEY, JSON.stringify(values));
      localStorage.setItem(SIDES_KEY, JSON.stringify(sides));
      localStorage.setItem(DROP_KEY, String(dropRate));
      localStorage.setItem(USE_CHANCE_KEY, useChance ? "1" : "0");
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [values, sides, dropRate, useChance, loaded]);

  const picks = useMemo(() => sides.map((s) => ({ boss: s.boss, diff: s.diff })), [sides]);
  const items = useMemo(() => itemsIn(picks, today), [picks, today]);
  const rows = useMemo(
    () => sides.map((s) => compareRow(s.boss, s.diff, s.party, today, values, dropRate, useChance)),
    [sides, today, values, dropRate, useChance],
  );
  const [a, b] = rows;
  const summary = useMemo(() => summarize(a, b), [a, b]);
  const gap = summary.mesoGap;
  const winner = gap === 0 ? null : gap > 0 ? 0 : 1;

  const setSide = (i: 0 | 1) => (s: Side) => setSides((prev) => (i === 0 ? [s, prev[1]] : [prev[0], s]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm" title="끄면 랜덤 보상을 기대값으로 환산하지 않고 단가만 보여 줍니다. 합계에는 결정과 확정 보상만 들어갑니다.">
          {/* 주황은 둘째 칸의 편 색이 됐다. 설정 요소까지 주황이면 편 표시로 읽힌다. */}
          <input type="checkbox" checked={useChance} onChange={(e) => setUseChance(e.target.checked)} className="accent-zinc-600 dark:accent-zinc-400" />
          <span>확률 보정</span>
        </label>

        {useChance && (
          <label className="flex items-center gap-1.5 text-sm" title="아이템 획득 증가. 알려진 드롭률 중 아획이 먹는 것만 이 값으로 보정합니다.">
            <span className="text-zinc-500">아이템 획득</span>
            <input
              type="number"
              min={0}
              max={999}
              value={dropRate}
              onChange={(e) => setDropRate(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
              className="w-16 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-center tabular-nums"
            />
            <span className="text-zinc-500">%</span>
          </label>
        )}

        <ItemValueModal items={items} values={values} onChange={setValues} filled={items.filter((i) => values[i.name]).length} />
        <button type="button" className="btn-ghost text-xs" onClick={() => setSides([sides[1], sides[0]])} title="두 보스를 맞바꿉니다">
          ⇄ 자리 바꾸기
        </button>
      </div>

      {/* 보스 둘은 왼쪽에 세로로, 결론은 오른쪽에. 결론이 눈에서 안 벗어난다. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,34rem)_20rem] items-start">
        <div className="space-y-3 min-w-0">
      {rows.map((r, i) => (
        <section key={i} className={`card space-y-3 border-l-4 ${SIDE_TONE[i].bar}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* 3인 보스로 바꿨는데 6인이 남아 있으면 안 되므로 고를 때도 자른다 */}
            <BossPickerModal
              boss={sides[i].boss}
              diff={sides[i].diff}
              today={today}
              onPick={(boss, diff: Difficulty) => setSide(i as 0 | 1)({ boss, diff, party: clampParty(boss, diff, sides[i].party) })}
            />
            <PartySizePicker
              value={sides[i].party}
              max={maxPartyFor(sides[i].boss, sides[i].diff)}
              onChange={(n) => setSide(i as 0 | 1)({ ...sides[i], party: n })}
              label={`${bossName(sides[i].boss)} 인원`}
              className="text-sm"
            />

            <span className="ml-auto flex items-baseline gap-2">
              <span className="text-xs text-zinc-500">합계</span>
              <b className={`text-xl tabular-nums ${winner === i ? SIDE_TONE[i].text : ""}`}>{fmtPower(r.total)}</b>
              {winner === i && <span className={`badge ${SIDE_TONE[i].badge}`}>+{fmtPower(Math.abs(gap))}</span>}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-zinc-100 dark:border-zinc-800 py-2 text-sm">
            <span>
              <span className="text-zinc-500">결정 (1인) </span>
              <b className="tabular-nums">{r.crystal == null ? <span className="text-xs font-normal text-zinc-400">가격 미등록</span> : fmtPower(r.crystal)}</b>
            </span>
            <span>
              <span className="text-zinc-500">확정 보상 </span>
              <b className="tabular-nums">{r.fixed.length}종</b>
              <span className="text-xs text-zinc-400"> (개수로 비교)</span>
            </span>
            <span>
              <span className="text-zinc-500">랜덤 기대값 </span>
              <b className="tabular-nums">{useChance ? (r.randomValue ? fmtPower(r.randomValue) : "-") : <span className="text-xs font-normal text-zinc-400">보정 꺼짐</span>}</b>
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-zinc-500">확정</span>
              <span className="text-[11px] text-zinc-400">잡으면 무조건 · {r.fixed.length}종 · 개수</span>
            </div>
            <Lines lines={[...r.fixed].sort((x, y) => (y.baseAmount ?? 0) - (x.baseAmount ?? 0) || x.name.localeCompare(y.name, "ko"))} empty="확정 보상 없음" counts />

            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-xs font-medium text-zinc-500">랜덤</span>
              <span className="text-[11px] text-zinc-400">
                확률 드롭 · {r.random.length}종{useChance ? "" : " · 단가 표시 (합계 제외)"}
              </span>
            </div>
            <Lines lines={ordered(r.random)} empty="랜덤 보상 없음" showUnit={!useChance} />
          </div>

          {r.hasUnpriced && <div className="text-[11px] text-zinc-400">&apos;값 없음&apos; 줄은 합계에 안 들어갑니다. 실제 값어치는 이보다 높습니다.</div>}
        </section>
      ))}
        </div>

        {/* 결론. 메소 차액만으로는 값 못 매긴 보상이 통째로 빠지므로 그 차이도 같이 낸다. */}
        <div className="card space-y-3 text-sm lg:sticky lg:top-4">
        <div>
          {winner == null ? (
            <span className="text-zinc-500">값으로 환산한 결과는 같습니다.</span>
          ) : (
            <span>
              <span className="inline-flex items-center gap-1.5 align-middle">
                <span className={`inline-block w-2 h-2 rounded-full ${SIDE_TONE[winner].dot}`} aria-hidden />
                <BossIcon boss={sides[winner].boss} diff={sides[winner].diff} size={32} showDiff={false} />
                <DifficultyBadge diff={sides[winner].diff} size="xs" solid />
                <b>{bossName(sides[winner].boss)}</b>
              </span>
              <span className="text-zinc-500"> 쪽이 메소로 </span>
              <b className={`tabular-nums ${SIDE_TONE[winner].text}`}>{fmtPower(Math.abs(gap))}</b>
              <span className="text-zinc-500"> 더 남습니다 ({sides[winner].party}인격 기준).</span>
            </span>
          )}
        </div>

        {summary.gaps.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <div className="text-xs font-medium text-zinc-500">값을 못 매긴 보상 차이</div>
            <p className="text-[11px] text-zinc-400">
              위 메소 차액에 안 들어간 몫입니다. 색이 어느 보스 몫인지 가리킵니다.
            </p>
            <ul className="space-y-1">
              {summary.gaps.map((g) => {
                const side = g.delta > 0 ? 0 : 1;
                return (
                  <li key={g.name} className="flex items-center gap-2" title={`${bossName(sides[side].boss)} — ${g.name}`}>
                    <span className={`inline-block w-1.5 h-4 rounded-sm shrink-0 ${SIDE_TONE[side].dot}`} aria-hidden />
                    <Icon icon={g.icon} w={g.w} h={g.h} short={g.short} name={g.name} />
                    <span className="min-w-0 flex-1 truncate text-xs">{g.name}</span>
                    <span className="sr-only">{bossName(sides[side].boss)}</span>
                    <b className={`text-xs tabular-nums shrink-0 w-12 text-right ${SIDE_TONE[side].text}`}>
                      {g.kind === "fixed" ? `+${Math.abs(g.delta)}개` : "단독"}
                    </b>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {summary.wash.length > 0 && (
          <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <div className="text-xs font-medium text-zinc-500">양쪽이 똑같이 주는 것 ({summary.wash.length}종)</div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {summary.wash.map((w) => (
                <span key={w.name} className="inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-800 px-1 py-0.5" title={w.name}>
                  <Icon icon={w.icon} w={w.w} h={w.h} short={w.short} name={w.name} />
                  {w.kind === "fixed" && w.a > 1 && <span className="text-[10px] text-zinc-500 tabular-nums pr-0.5">×{w.a}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        결정은 가격표를 인원수로 나눈 값입니다. 조각·큐브는 파티 한 몫이 떨어져 인원수로 나뉘고 소수점은 버립니다. 랜덤은 단가 × 확률입니다.
        <br />
        <b>확률은 넥슨이 공개하지 않습니다.</b> 표본 수가 붙은 확률은 커뮤니티 통계이며, 표본이 작을수록 오차가 큽니다. 직접 넣은 값이 있으면 그쪽이 우선합니다. 아이템 획득 증가는 그것이 적용되는
        아이템(장신구·반지 상자·연마석)에만 곱합니다. (통계 기준 {DROP_META.updated})
      </p>
    </div>
  );
}
