import { describe, expect, it } from "vitest";
import { fmtMesoFull, fmtPower } from "@/lib/maple/format";

describe("메소 전체 표기", () => {
  it("억·만·나머지를 모두 낸다", () => {
    expect(fmtMesoFull(1_234_567_890)).toBe("12억 3456만 7890 메소");
  });

  it("비는 자리는 건너뛴다", () => {
    expect(fmtMesoFull(300_000_000)).toBe("3억 메소");
    expect(fmtMesoFull(30_000_000)).toBe("3000만 메소");
    expect(fmtMesoFull(100_005_000)).toBe("1억 5000 메소");
  });

  it("만 아래만 있어도 낸다", () => {
    expect(fmtMesoFull(5_000)).toBe("5000 메소");
    expect(fmtMesoFull(1)).toBe("1 메소");
  });

  it("0 과 없음을 구분한다", () => {
    expect(fmtMesoFull(0)).toBe("0 메소");
    expect(fmtMesoFull(null)).toBe("-");
    expect(fmtMesoFull(undefined)).toBe("-");
  });

  it("fmtPower 는 만 아래를 버린다 (목록용이라 그대로 둔다)", () => {
    expect(fmtPower(1_234_567_890)).toBe("12억 3456만");
    expect(fmtMesoFull(1_234_567_890)).not.toBe(fmtPower(1_234_567_890));
  });
});
