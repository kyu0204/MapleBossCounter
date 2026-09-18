/**
 * 아이템 이름 → 아이콘.
 *
 * 보스 보상 아이콘은 보상 데이터 안에 박혀 있어 보스를 통해야 찾을 수 있다. 상자 구성품처럼
 * 어느 보스의 보상도 아닌 아이템은 거기 없고 extra_item_icons.json 에만 있다.
 * 시세 탭은 둘 다 이름만 들고 그리므로, 여기서 한 색인으로 합친다.
 *
 * 아이콘은 전부 public/items 에 자체 호스팅한다. 런타임에 외부로 요청하지 않는다.
 */
import rewards from "@/data/boss_rewards.json";
import extra from "@/data/extra_item_icons.json";

export interface ItemIcon {
  src: string;
  w: number;
  h: number;
}

interface IconRow {
  name: string;
  icon?: string;
  w?: number;
  h?: number;
}

interface RewardsShape {
  bosses: Record<string, Record<string, { rewards: IconRow[]; cubes?: Record<string, IconRow> }>>;
}

interface ExtraShape {
  items: Record<string, { file: string; w: number; h: number }>;
}

// 파일 이름에 공백과 괄호가 들어가므로 경로 조각을 인코딩한다. 안 하면 일부 브라우저가 못 받는다.
const encodePath = (f: string) => f.split("/").map(encodeURIComponent).join("/");

const index = new Map<string, ItemIcon>();

for (const diffs of Object.values((rewards as unknown as RewardsShape).bosses)) {
  for (const row of Object.values(diffs)) {
    for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
      if (!r.icon || !r.w || !r.h || index.has(r.name)) continue;
      index.set(r.name, { src: encodePath(r.icon), w: r.w, h: r.h });
    }
  }
}

for (const [name, v] of Object.entries((extra as unknown as ExtraShape).items ?? {})) {
  if (!index.has(name)) index.set(name, { src: encodePath(v.file), w: v.w, h: v.h });
}

export function iconOf(name: string): ItemIcon | null {
  return index.get(name) ?? null;
}
