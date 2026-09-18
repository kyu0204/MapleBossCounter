import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allPrices, noMarketItems } from "@/lib/maple/itemPrices";
import { iconOf } from "@/lib/maple/itemIcons";

const pub = (src: string) => path.join(process.cwd(), "public", decodeURIComponent(src).replace(/^\//, ""));

describe("아이템 아이콘 색인", () => {
  it("보상 아이콘과 반입 아이콘을 함께 찾는다", () => {
    // 보상 데이터에 박힌 것
    expect(iconOf("루즈 컨트롤 머신 마크")).not.toBeNull();
    // extra_item_icons.json 에만 있는 것 (어느 보스의 보상도 아닌 상자 속)
    expect(iconOf("에테르넬 아처케이프")).not.toBeNull();
  });

  it("시세가 잡힌 아이템은 전부 아이콘이 있다", () => {
    const missing = allPrices()
      .map(([n]) => n)
      .filter((n) => !iconOf(n));
    expect(missing).toEqual([]);
  });

  it("아이콘 파일이 public 에 실제로 있고 크기를 들고 있다", () => {
    for (const [name] of [...allPrices(), ...noMarketItems()]) {
      const icon = iconOf(name);
      if (!icon) continue;
      expect(fs.existsSync(pub(icon.src)), `${name}: ${icon.src}`).toBe(true);
      expect(icon.w, name).toBeGreaterThan(0);
      expect(icon.h, name).toBeGreaterThan(0);
    }
  });
});
