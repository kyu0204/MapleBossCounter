import type { ContentRow } from "@/lib/maple/scheduler";

const QUEST_LABEL: Record<string, string> = { todo: "⬜ 미완료", progress: "🔄 진행중", done: "✅ 완료", unknown: "?" };

export function ContentsList({ title, items }: { title: string; items: ContentRow[] }) {
  if (!items.length) return null;
  return (
    <div className="card text-sm">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="space-y-0.5">
        {items.map((c) => (
          <li key={c.name} className={`flex justify-between gap-2 ${c.registered ? "" : "text-zinc-400"}`}>
            <span className="truncate">
              {c.kind === "quest" && <span className="text-xs mr-1">[퀘스트]</span>}
              {c.name}
            </span>
            <span className="whitespace-nowrap text-xs">{c.kind === "quest" ? QUEST_LABEL[c.questState ?? "unknown"] : c.max > 0 ? `${c.now}/${c.max}` : `${c.now}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
