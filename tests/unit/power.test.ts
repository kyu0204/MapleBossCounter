import { describe, expect, it } from "vitest";
import { setupHashes, updateBest, hashItemList, type EquipItem } from "@/lib/maple/power";

const item = (slot: string, name: string, star: string): EquipItem => ({ item_equipment_slot: slot, item_name: name, starforce: star });
const setA = [item("모자", "아케인 햇", "22"), item("무기", "아케인 완드", "22")];
const setB = [item("모자", "아케인 햇", "22"), item("무기", "제네시스 완드", "0")];
const drop = [...setA, item("반지1", "드메 반지", "0")];

describe("updateBest (프로토타입 4시나리오)", () => {
  it("1) 첫 측정 → 최대 등록", () => {
    const r = updateBest(null, 1_500_000_000, setupHashes({ item_equipment: setA }), "t1");
    expect(r.note).toBe("new_best");
    expect(r.best).toEqual({ power: 1_500_000_000, ts: "t1", setupHash: hashItemList(setA) });
  });
  it("2) 낮은 값 재측정 → 유지", () => {
    const b = updateBest(null, 1_500_000_000, setupHashes({ item_equipment: setA }), "t1").best;
    const r = updateBest(b, 1_400_000_000, setupHashes({ item_equipment: setA }), "t2");
    expect(r.note).toBeNull();
    expect(r.best.power).toBe(1_500_000_000);
  });
  it("3) 드메템 착용, 프리셋1에 원 세팅 보존 → 유지", () => {
    const b = updateBest(null, 1_500_000_000, setupHashes({ item_equipment: setA }), "t1").best;
    const r = updateBest(b, 1_000_000_000, setupHashes({ item_equipment: drop, item_equipment_preset_1: setA }), "t3");
    expect(r.note).toBeNull();
    expect(r.best.power).toBe(1_500_000_000);
  });
  it("4) 세팅 교체(어디에도 없음) → 무효화 후 재설정", () => {
    const b = updateBest(null, 1_500_000_000, setupHashes({ item_equipment: setA }), "t1").best;
    const r = updateBest(b, 1_200_000_000, setupHashes({ item_equipment: setB, item_equipment_preset_1: setB }), "t4");
    expect(r.note).toBe("invalidated");
    expect(r.previousBest?.power).toBe(1_500_000_000);
    expect(r.best.power).toBe(1_200_000_000);
  });
  it("해시는 슬롯 순서에 무관, 외형 필드 무시", () => {
    const a = hashItemList([item("모자", "A", "1"), item("무기", "B", "2")]);
    const b = hashItemList([item("무기", "B", "2"), { ...item("모자", "A", "1"), item_icon: "x" }]);
    expect(a).toBe(b);
  });
});
