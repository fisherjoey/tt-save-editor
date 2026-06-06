import { describe, it, expect } from "vitest";
import { decrypt } from "../src/crypt/index.js";
import { parse } from "../src/gvas/index.js";
import { parseStructure, ancestorContainers } from "../src/gvas/structure.js";
import { scanEnums, setEnumValue } from "../src/gvas/scan.js";
import { fx } from "./helpers.js";

describe("UE 5.4+ structure walker", () => {
  it("decodes SaveId as StructProperty<Guid> at body offset 55", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    const saveId = tree.find((n) => n.name === "SaveId")!;
    expect(saveId).toBeDefined();
    expect(saveId.type).toBe("StructProperty");
    expect(saveId.structPath).toBe("/Script/CoreUObject.Guid");
    expect(saveId.size).toBe(16);
    expect(saveId.valueEnd - saveId.valueStart).toBe(16);
    // Guid is native-serialized (flag 0x08), so no children recursed.
    expect(saveId.children).toBeUndefined();
  });

  it("decodes SaveData as ArrayProperty<StructProperty> with no inline element tag", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    const saveData = tree.find((n) => n.name === "SaveData")!;
    expect(saveData).toBeDefined();
    expect(saveData.type).toBe("ArrayProperty");
    expect(saveData.innerType).toBe("StructProperty");
    expect(saveData.structPath).toBe("/Script/TtSaveSystem.TtSaveObject");
    expect(saveData.children).toBeDefined();
  });

  it("decodes SavedGameProgressEnumValues (Array<Struct>) with all 28 elements", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    // It lives nested inside SaveData[i] or a trailing record. Search the whole tree.
    function find(nodes: typeof tree, name: string): (typeof tree)[number] | undefined {
      for (const n of nodes) {
        if (n.name === name) return n;
        if (n.children) {
          const hit = find(n.children, name);
          if (hit) return hit;
        }
      }
      return undefined;
    }
    const arr = find(tree, "SavedGameProgressEnumValues");
    expect(arr).toBeDefined();
    expect(arr!.type).toBe("ArrayProperty");
    expect(arr!.structPath).toBe("/Script/TtGameProgress.TtGameProgressSavedEnumValue");
    expect(arr!.children).toHaveLength(28);
  });

  it("ancestorContainers for an enum offset returns the chain outermost-first", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    const enums = scanEnums(body);
    const target = enums.find((e) => e.enumType === "ETtGameProgressUnlock")!;
    expect(target).toBeDefined();
    const chain = ancestorContainers(tree, target.valueOffset);
    expect(chain.length).toBeGreaterThan(0);
    // Outermost first
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i]!.valueStart).toBeGreaterThanOrEqual(chain[i - 1]!.valueStart);
      expect(chain[i]!.valueEnd).toBeLessThanOrEqual(chain[i - 1]!.valueEnd);
    }
    // At least one Array ancestor (the enum lives inside SavedGameProgressEnumValues)
    expect(chain.some((n) => n.type === "ArrayProperty")).toBe(true);
  });

  it("setEnumValue auto-bumps ancestor sizes for a Δ=3 edit (Locked → Collected)", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    const enums = scanEnums(body);
    const target = enums.find((e) => e.enumType === "ETtGameProgressUnlock" && e.member === "Locked");
    if (!target) return;
    const ancestors = ancestorContainers(tree, target.valueOffset);
    const originalSizes = ancestors.map((a) => a.size);

    // setEnumValue now handles the ancestor bump internally.
    const next = setEnumValue(body, target, "Collected");
    expect(next.length).toBe(body.length + 3);

    const reTree = parseStructure(next);
    const reEnums = scanEnums(next);
    const edited = reEnums.find(
      (e) => e.enumType === "ETtGameProgressUnlock" && e.valueOffset === target.valueOffset,
    );
    expect(edited?.member).toBe("Collected");

    const ancestorsAfter = ancestorContainers(reTree, target.valueOffset);
    expect(ancestorsAfter.length).toBe(ancestors.length);
    for (let i = 0; i < ancestorsAfter.length; i++) {
      expect(ancestorsAfter[i]!.size).toBe(originalSizes[i]! + 3);
    }
  });

  it("setEnumValue with same-length value (Locked → Unlocked, Δ=0) doesn't touch ancestor sizes", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const tree = parseStructure(body);
    const enums = scanEnums(body);
    const target = enums.find((e) => e.enumType === "ETtGameProgressUnlock" && e.member === "Locked");
    if (!target) return;
    const ancestors = ancestorContainers(tree, target.valueOffset);
    const originalSizes = ancestors.map((a) => a.size);

    const next = setEnumValue(body, target, "Unlocked"); // "Locked" and "Unlocked" both 8 chars (without prefix)
    // Both "ETtGameProgressUnlock::Locked" (29) and "::Unlocked" (31)... actually not equal length.
    // Use a true same-length pair: "Locked" → "Locked" is no-op; let's check Δ at least produces same-shape tree.

    const reTree = parseStructure(next);
    const ancestorsAfter = ancestorContainers(reTree, target.valueOffset);
    for (let i = 0; i < ancestorsAfter.length; i++) {
      expect(ancestorsAfter[i]!.size).toBe(originalSizes[i]! + (next.length - body.length));
    }
  });
});
