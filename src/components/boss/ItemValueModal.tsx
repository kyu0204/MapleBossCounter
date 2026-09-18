"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemRef, ItemValues } from "@/lib/maple/compare";
import { ItemValueEditor } from "./ItemValueEditor";

/**
 * 아이템 값 입력 모달.
 *
 * 화면 안에서 펼치면 그만큼 보스 카드가 아래로 밀려, 값을 넣으면서 결과가 어떻게
 * 바뀌는지 볼 수가 없다. 모달로 띄우면 닫는 순간 같은 자리에서 결과를 본다.
 *
 * 값은 입력 즉시 반영된다 (저장 버튼 없음). 모달 뒤로 합계가 바뀌고 있으므로
 * 닫자마자 결과가 맞아 있다.
 */
export function ItemValueModal({
  items,
  values,
  onChange,
  filled,
}: {
  items: ItemRef[];
  values: ItemValues;
  onChange: (next: ItemValues) => void;
  filled: number;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // 모달이 떠 있는 동안 뒤 화면이 스크롤되지 않게
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(true)}>
        아이템 값 설정 ({filled}/{items.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="아이템 값 설정"
            tabIndex={-1}
            className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl outline-none"
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 py-3">
              <h2 className="font-semibold">아이템 값 설정</h2>
              <span className="text-sm text-zinc-500">
                {filled}/{items.length} 입력됨
              </span>
              <button className="btn-primary text-xs ml-auto" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <div className="p-4">
              <ItemValueEditor items={items} values={values} onChange={onChange} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
