"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRow, itemsIn, type ItemValues, type RewardLine } from "@/lib/maple/compare";
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

/** 값이 매겨진 줄만, 큰 것부터. 0 짜리는 자리만 차지한다. */
const priced = (lines: RewardLine[]) => lines.filter((l) => l.value > 0).sort((a, b) => b.value - a.value);

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

/** 보상 줄. 아이콘 + 수량 + 값어치. */
function Lines({ lines, empty }: { lines: RewardLine[]; empty: string }) {
  if (!lines.length) return <div className="text-xs text-zinc-400">{empty}</div>;
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l.name} className="flex items-center gap-2" title={l.name}>
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: ICON_BOX.w, height: ICON_BOX.h }}>
            {l.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.icon} alt="" width={l.w} height={l.h} style={{ width: l.w, height: l.h }} className="object-contain" loading="lazy" decoding="async" />
            ) : (
              <span className="text-[10px] leading-none text-center">{l.short ?? l.name}</span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs">{l.name}</span>
          <span className="text-xs text-zinc-500 tabular-nums shrink-0">×{l.amountText}</span>
          <b className="text-xs tabular-nums shrink-0 w-20 text-right">{fmtPower(l.value)}</b>
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
  const gap = a.total - b.total;
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
              <div className="text-xs font-medium text-zinc-500">확정</div>
              <Lines lines={priced(r.fixed)} empty={r.fixed.length ? "값을 매긴 확정 보상이 없습니다" : "확정 보상 없음"} />
              <div className="text-xs font-medium text-zinc-500 pt-1">랜덤</div>
              <Lines lines={priced(r.random)} empty={r.random.length ? "값·확률을 매긴 랜덤 보상이 없습니다" : "랜덤 보상 없음"} />
            </div>

            {r.hasUnpriced && (
              <div className="text-[11px] text-zinc-400">
                값을 안 매긴 보상이 있어 합계가 실제보다 낮습니다. &apos;아이템 값 설정&apos;에서 채우세요.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 차이를 한 줄로. 카드를 번갈아 보지 않아도 결론이 보인다. */}
      <div className="card text-sm">
        {winner == null ? (
          <span className="text-zinc-500">두 보스의 값어치가 같습니다.</span>
        ) : (
          <span>
            <span className="inline-flex items-center gap-1.5 align-middle">
              <BossIcon boss={sides[winner].boss} diff={sides[winner].diff} size={32} showDiff={false} />
              <DifficultyBadge diff={sides[winner].diff} size="xs" solid />
              <b>{bossName(sides[winner].boss)}</b>
            </span>
            <span className="text-zinc-500"> 쪽이 </span>
            <b className="text-orange-600 dark:text-orange-400 tabular-nums">{fmtPower(Math.abs(gap))}</b>
            <span className="text-zinc-500"> 더 남습니다 ({sides[winner].party}인격 기준).</span>
          </span>
        )}
      </div>

      <p className="text-[11px] text-zinc-400">
        결정은 가격표를 인원수로 나눈 값입니다. 조각·큐브는 파티 한 몫이 떨어져 인원수로 나뉘고 소수점은 버립니다. 랜덤은 단가 × 확률이며, 확률은 넥슨이 공개하지 않아 직접 넣은 추정값입니다.
      </p>
    </div>
  );
}
