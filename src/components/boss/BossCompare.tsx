"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRow, itemsIn, summarize, type ItemValues, type RewardLine } from "@/lib/maple/compare";
import { bossName } from "@/lib/maple/bossMeta";
import { fmtPower } from "@/lib/maple/format";
import { ICON_BOX } from "@/lib/maple/rewards";
import type { Difficulty } from "@/lib/maple/bossKey";
import { BossIcon } from "@/components/boss/BossIcon";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { BossPickerModal } from "@/components/party/BossPickerModal";
import { ItemValueEditor } from "./ItemValueEditor";

/**
 * 보스 둘을 맞대 놓고 한 번 잡을 때의 값어치를 견준다.
 *
 * 전체 목록을 한 표에 늘어놓으면 눈이 줄을 따라가느라 정작 "이 둘 중 뭐가 나은가" 가
 * 안 보인다. 실제로 고민하는 건 늘 두 보스 사이다.
 *
 * 인원은 양쪽 따로 잡는다. "하드 세렌 2인" 과 "노말 카링 솔로" 처럼 조건이 다른 둘을
 * 견주는 것이 이 화면의 쓸모다.
 *
 * 아이템 값어치는 시세라 코드에 박지 않는다. 화면에서 받아 이 브라우저에만 둔다.
 * 안 넣은 아이템은 0 이고, 그 줄을 흐리게 해 합계가 실제보다 낮다는 것을 드러낸다.
 */
const VALUES_KEY = "maple-item-values";
const SIDES_KEY = "maple-compare-sides";

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
 * 보상 줄 정렬. 값을 매긴 것이 큰 것부터 위, 값을 안 매긴 것은 그 아래 이름순.
 *
 * 값 없는 줄도 지우지 않는다. 그 보스가 무엇을 주는지가 곧 비교 근거이고,
 * 안 보이면 값을 넣을 생각조차 못 한다.
 */
const ordered = (lines: RewardLine[]) =>
  [...lines].sort((a, b) => Number(a.unpriced) - Number(b.unpriced) || b.value - a.value || a.name.localeCompare(b.name, "ko"));

function SideHeader({ side, today, onChange }: { side: Side; today: string; onChange: (s: Side) => void }) {
  return (
    <div className="space-y-2">
      <BossPickerModal boss={side.boss} diff={side.diff} today={today} onPick={(boss, diff: Difficulty) => onChange({ ...side, boss, diff })} />
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-zinc-500">인원</span>
        <input
          type="number"
          min={1}
          max={6}
          value={side.party}
          onChange={(e) => onChange({ ...side, party: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
          className="w-14 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-center tabular-nums"
          aria-label={`${side.boss} 인원`}
        />
        <span className="text-zinc-500">인격</span>
      </label>
    </div>
  );
}

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
 * 보상 줄. 아이콘 + 수량 + 값어치.
 *
 * 값을 안 매긴 줄은 흐리게 두고 값 자리에 "값 없음" 을 적는다. 0 원으로 적으면
 * 정말 가치가 없는 것처럼 읽힌다 — 모르는 것과 0 은 다르다.
 */
function Lines({ lines, empty, showZero }: { lines: RewardLine[]; empty: string; showZero?: boolean }) {
  if (!lines.length) return <div className="text-xs text-zinc-400">{empty}</div>;
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l.name} className={`flex items-center gap-2 ${l.unpriced ? "opacity-60" : ""}`} title={l.name}>
          <Icon icon={l.icon} w={l.w} h={l.h} short={l.short} name={l.name} />
          <span className="min-w-0 flex-1 truncate text-xs">{l.name}</span>
          {showZero && <span className="text-xs text-zinc-500 tabular-nums shrink-0">×{l.amountText}</span>}
          <span className="text-xs tabular-nums shrink-0 w-20 text-right">
            {l.unpriced ? <span className="text-[11px] text-zinc-400">값 없음</span> : <b>{fmtPower(l.value)}</b>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BossCompare({ today }: { today: string }) {
  const [values, setValues] = useState<ItemValues>({});
  const [sides, setSides] = useState<[Side, Side]>(DEFAULT_SIDES);
  const [openValues, setOpenValues] = useState(false);
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
    } catch {
      /* 저장 못 해도 화면은 돈다 */
    }
  }, [values, sides, loaded]);

  const picks = useMemo(() => sides.map((s) => ({ boss: s.boss, diff: s.diff })), [sides]);
  const items = useMemo(() => itemsIn(picks, today), [picks, today]);
  const rows = useMemo(() => sides.map((s) => compareRow(s.boss, s.diff, s.party, today, values)), [sides, today, values]);
  const [a, b] = rows;
  const summary = useMemo(() => summarize(a, b), [a, b]);
  const gap = summary.mesoGap;
  const winner = gap === 0 ? null : gap > 0 ? 0 : 1;
  const pricedCount = Object.keys(values).length;

  const setSide = (i: 0 | 1) => (s: Side) => setSides((prev) => (i === 0 ? [s, prev[1]] : [prev[0], s]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost text-xs" onClick={() => setOpenValues((v) => !v)}>
          아이템 값 {openValues ? "접기" : `설정 (${items.filter((i) => values[i.name]).length}/${items.length})`}
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => setSides([sides[1], sides[0]])} title="좌우 바꾸기">
          ⇄ 자리 바꾸기
        </button>
        {pricedCount === 0 && <span className="text-xs text-amber-700 dark:text-amber-400">아이템 값을 넣으면 보상까지 합쳐 비교합니다. 지금은 결정만 견주는 중입니다.</span>}
      </div>

      {openValues && (
        <div className="card">
          <ItemValueEditor items={items} values={values} onChange={setValues} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`card space-y-3 ${winner === i ? "border-orange-300 dark:border-orange-800" : ""}`}
          >
            <SideHeader side={sides[i]} today={today} onChange={setSide(i as 0 | 1)} />

            <div className="flex items-baseline gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
              <span className="text-xs text-zinc-500">합계</span>
              <b className={`text-xl tabular-nums ${winner === i ? "text-orange-600 dark:text-orange-400" : ""}`}>{fmtPower(r.total)}</b>
              {winner === i && <span className="badge bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200">+{fmtPower(Math.abs(gap))}</span>}
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">결정 (1인)</dt>
                <dd className="tabular-nums">{r.crystal == null ? <span className="text-xs text-zinc-400">가격 미등록</span> : fmtPower(r.crystal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">확정 보상</dt>
                <dd className="tabular-nums">{r.fixedValue ? fmtPower(r.fixedValue) : "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">랜덤 기대값</dt>
                <dd className="tabular-nums">{r.randomValue ? fmtPower(r.randomValue) : "-"}</dd>
              </div>
            </dl>

            <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-zinc-500">확정</span>
                <span className="text-[11px] text-zinc-400">잡으면 무조건 · {r.fixed.length}종</span>
              </div>
              {/* 확정은 수량이 곧 값어치의 근거라 같이 보여 준다 */}
              <Lines lines={ordered(r.fixed)} empty="확정 보상 없음" showZero />

              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-xs font-medium text-zinc-500">랜덤</span>
                <span className="text-[11px] text-zinc-400">확률 드롭 · {r.random.length}종</span>
              </div>
              {/* 랜덤의 수량은 "떴을 때" 개수라 기대값과 같이 놓으면 오해를 부른다 */}
              <Lines lines={ordered(r.random)} empty="랜덤 보상 없음" />
            </div>

            {r.hasUnpriced && (
              <div className="text-[11px] text-zinc-400">
                &apos;값 없음&apos; 줄은 합계에 안 들어갑니다. 실제 값어치는 이보다 높습니다.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 결론. 메소 차액만으로는 값 못 매긴 보상이 통째로 빠지므로 그 차이도 같이 낸다. */}
      <div className="card space-y-3 text-sm">
        <div>
          {winner == null ? (
            <span className="text-zinc-500">값으로 환산한 결과는 같습니다.</span>
          ) : (
            <span>
              <span className="inline-flex items-center gap-1.5 align-middle">
                <BossIcon boss={sides[winner].boss} diff={sides[winner].diff} size={32} showDiff={false} />
                <DifficultyBadge diff={sides[winner].diff} size="xs" solid />
                <b>{bossName(sides[winner].boss)}</b>
              </span>
              <span className="text-zinc-500"> 쪽이 메소로 </span>
              <b className="text-orange-600 dark:text-orange-400 tabular-nums">{fmtPower(Math.abs(gap))}</b>
              <span className="text-zinc-500"> 더 남습니다 ({sides[winner].party}인격 기준).</span>
            </span>
          )}
        </div>

        {summary.gaps.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <div className="text-xs font-medium text-zinc-500">값을 못 매긴 보상 차이</div>
            <p className="text-[11px] text-zinc-400">위 메소 차액에 안 들어간 몫입니다. 이만큼을 얹어 판단하세요.</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {summary.gaps.map((g) => {
                const side = g.delta > 0 ? 0 : 1;
                return (
                  <li key={g.name} className="flex items-center gap-2" title={g.name}>
                    <Icon icon={g.icon} w={g.w} h={g.h} short={g.short} name={g.name} />
                    <span className="min-w-0 flex-1 truncate text-xs">{g.name}</span>
                    <span className="text-xs shrink-0 text-zinc-500 truncate max-w-[9rem]" title={bossName(sides[side].boss)}>
                      {bossName(sides[side].boss)}
                    </span>
                    <b className="text-xs tabular-nums shrink-0 w-14 text-right text-orange-600 dark:text-orange-400">
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
            <p className="text-[11px] text-zinc-400">서로 상쇄되므로 비교에서 빼고 봐도 됩니다.</p>
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

      <p className="text-[11px] text-zinc-400">
        결정은 가격표를 인원수로 나눈 값입니다. 조각·큐브는 파티 한 몫이 떨어져 인원수로 나뉘고 소수점은 버립니다. 랜덤은 단가 × 확률이며, 확률은 넥슨이 공개하지 않아 직접 넣은 추정값입니다.
      </p>
    </div>
  );
}
