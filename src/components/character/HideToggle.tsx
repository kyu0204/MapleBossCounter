"use client";

import { useTransition } from "react";
import { setHidden } from "@/actions/characters";

export function HideToggle({ ocid, hidden }: { ocid: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-ghost text-xs py-1" disabled={pending} onClick={() => start(() => setHidden(ocid, !hidden).then(() => undefined))}>
      {hidden ? "표시" : "숨기기"}
    </button>
  );
}
