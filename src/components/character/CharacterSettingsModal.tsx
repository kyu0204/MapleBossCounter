"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setHidden } from "@/actions/characters";
import { CharacterAvatar } from "./CharacterAvatar";

export interface CharacterRow {
  ocid: string;
  name: string;
  world: string | null;
  cls: string | null;
  level: number | null;
  imageUrl: string | null;
  hidden: boolean;
}

/**
 * "설정" 버튼 + 모달. 캐릭터를 목록에서 숨기거나 다시 꺼낸다.
 *
 * 카드마다 숨기기 버튼을 두면 카드를 눌러 상세로 가는 동작과 부딪히고,
 * 캐릭터가 수십 개일 때 버튼만 잔뜩 보인다. 한곳에 모아 둔다.
 *
 * 레벨 기준 자동 숨김(DASHBOARD_MIN_LEVEL)과는 별개다. 여기서 끄고 켜는 것은
 * 손으로 정한 숨김이다.
 */
export function CharacterSettingsModal({ characters, minLevel }: { characters: CharacterRow[]; minLevel: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pendingOcid, setPendingOcid] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle ? characters.filter((c) => c.name.toLowerCase().includes(needle) || (c.world ?? "").toLowerCase().includes(needle)) : characters;
    // 월드 → 레벨 내림차순. 숨김 여부로 갈라 놓으면 찾던 캐릭터가 토글할 때마다 튄다.
    return [...rows].sort((a, b) => (a.world ?? "").localeCompare(b.world ?? "", "ko") || (b.level ?? 0) - (a.level ?? 0));
  }, [characters, q]);

  const hiddenCount = characters.filter((c) => c.hidden).length;

  function toggle(c: CharacterRow) {
    setPendingOcid(c.ocid);
    setMsg(null);
    start(async () => {
      const r = await setHidden(c.ocid, !c.hidden);
      setPendingOcid(null);
      if (!r.ok) setMsg(r.message);
    });
  }

  return (
    <>
      <button className="btn-ghost text-sm" onClick={() => setOpen(true)}>
        설정
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="캐릭터 설정"
            tabIndex={-1}
            className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl outline-none"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <h2 className="font-semibold">캐릭터 설정</h2>
              <span className="text-sm text-zinc-500">
                전체 {characters.length}개{hiddenCount > 0 && ` · ${hiddenCount}개 숨김`}
              </span>
              <button className="ml-auto btn-ghost text-xs" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>

            <div className="px-4 pt-3">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="캐릭터명 또는 월드 검색"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
                aria-label="캐릭터 검색"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {list.length === 0 ? (
                <div className="text-sm text-zinc-500">찾는 캐릭터가 없습니다.</div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.map((c) => (
                    <li key={c.ocid} className={`flex items-center gap-3 py-2 ${c.hidden ? "opacity-50" : ""}`}>
                      <CharacterAvatar src={c.imageUrl} alt="" size={44} />
                      <span className="flex flex-col min-w-0 leading-tight">
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-xs text-zinc-500 truncate">
                          {c.world} · {c.cls} · Lv.{c.level}
                          {(c.level ?? 0) < minLevel && <span className="ml-1 text-zinc-400">Lv.{minLevel} 미만</span>}
                        </span>
                      </span>
                      <button className="ml-auto btn-ghost text-xs shrink-0" onClick={() => toggle(c)} disabled={pendingOcid === c.ocid}>
                        {pendingOcid === c.ocid ? "…" : c.hidden ? "표시" : "숨기기"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {msg && <div className="pt-2 text-sm text-red-600">{msg}</div>}
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 text-[11px] text-zinc-400">
              숨긴 캐릭터는 목록에서 빠집니다. Lv.{minLevel} 미만은 숨기지 않아도 기본으로 안 보이며, 목록 위 &apos;전체 보기&apos;로 함께 볼 수 있습니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
