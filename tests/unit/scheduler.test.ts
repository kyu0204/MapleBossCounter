import { describe, expect, it } from "vitest";
import { parseSnapshot } from "@/lib/maple/scheduler";

const base = {
  date: null,
  character_name: "알전임",
  world_name: "스카니아",
  character_level: 287,
  character_class: "아크메이지(불,독)",
  boss_contents: [],
};

describe("주간 보스 한도 파싱", () => {
  it("넥슨이 준 값을 그대로 쓴다", () => {
    const s = parseSnapshot({ ...base, weekly_boss_clear_count: 8, weekly_boss_clear_limit_count: 12 });
    expect(s.weeklyLimit).toBe(12);
    expect(s.weeklyClearCount).toBe(8);
  });

  it("한도 0 은 '모름' 으로 보고 12 로 채운다", () => {
    // 주간 리셋 직후, 그 캐릭터로 아직 접속하지 않으면 넥슨이 0 을 준다.
    // 그대로 두면 화면에 0/0 이 뜨고 "입장 한도(0)를 넘게 골랐다" 는 거짓 경고가 난다.
    const s = parseSnapshot({ ...base, weekly_boss_clear_count: 0, weekly_boss_clear_limit_count: 0 });
    expect(s.weeklyLimit).toBe(12);
    expect(s.weeklyClearCount).toBe(0);
  });

  it("한도 칸이 아예 없어도 12", () => {
    const s = parseSnapshot({ ...base, weekly_boss_clear_count: 0 } as never);
    expect(s.weeklyLimit).toBe(12);
  });

  it("클리어 수 0 은 0 그대로 둔다 (리셋 직후가 실제로 0 이다)", () => {
    const s = parseSnapshot({ ...base, weekly_boss_clear_count: 0, weekly_boss_clear_limit_count: 12 });
    expect(s.weeklyClearCount).toBe(0);
  });
});
