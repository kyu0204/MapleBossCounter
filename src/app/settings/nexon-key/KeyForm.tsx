"use client";

import { useActionState } from "react";
import { registerNexonKey } from "@/actions/nexon-key";

export function KeyForm() {
  const [state, action, pending] = useActionState(registerNexonKey, null);
  return (
    <form action={action} className="space-y-2">
      <input name="apiKey" type="password" autoComplete="off" placeholder="test_ 또는 live_ 로 시작하는 키" className="input font-mono" required />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "검증 중…" : "저장"}
        </button>
        {state && <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
