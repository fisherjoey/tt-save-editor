import { describe, it, expect } from "vitest";
import { SaveFile } from "../src/sav/index.js";
import { enumOptions, KNOWN_ENUMS, prettifyKey } from "../src/enums.js";
import { fx } from "./helpers.js";

describe("enum scanning + dropdowns", () => {
  it("finds the ETtSaveGameVersion enum field", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const e = sf.enums().find((x) => x.enumType === "ETtSaveGameVersion");
    expect(e, "ETtSaveGameVersion enum present").toBeDefined();
    expect(e!.value.startsWith("ETtSaveGameVersion::")).toBe(true);
  });

  it("dropdown options include every known member regardless of byte length (v0.1.2)", () => {
    // ETtGameProgressUnlock: Locked, Unlocked, Collected — all different lengths
    const fromLocked = enumOptions("ETtGameProgressUnlock", new Set(), "Locked");
    expect(fromLocked).toEqual(expect.arrayContaining(["Locked", "Unlocked", "Collected"]));
    // ETtChallengeGameProgressState: Locked, Unlocked, Completed, Rewarded
    const fromChallengeUnlocked = enumOptions("ETtChallengeGameProgressState", new Set(), "Unlocked");
    expect(fromChallengeUnlocked).toEqual(expect.arrayContaining(["Locked", "Unlocked", "Completed", "Rewarded"]));
  });

  it("KNOWN_ENUMS still lists every documented member (for v0.1.2 when restriction lifts)", () => {
    expect(KNOWN_ENUMS.ETtSaveGameVersion).toContain("NoVersion");
    expect(KNOWN_ENUMS.ETtSaveGameVersion).toContain("LatestVersion");
  });

  it("edits an enum member safely and re-loads to the new value", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const e = sf.enums().find((x) => x.enumType === "ETtSaveGameVersion")!;
    sf.setEnum(e, "LatestVersion");
    const reloaded = SaveFile.load(sf.toBytes());
    const e2 = reloaded.enums().find((x) => x.enumType === "ETtSaveGameVersion")!;
    expect(e2.member).toBe("LatestVersion");
    expect(SaveFile.load(reloaded.toBytes()).toBytes()).toEqual(reloaded.toBytes());
  });

  it("captures a distinguishing context key for duplicate enum types", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const unlocks = sf.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(unlocks.length).toBeGreaterThan(1);
    expect(new Set(unlocks.map((e) => e.context)).size).toBeGreaterThan(1);
  });

  it("bulk-sets every entry of an enum type and re-loads cleanly", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const unlocks = sf.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    sf.setEnumsBulk(unlocks, "Collected");
    const reloaded = SaveFile.load(sf.toBytes());
    const after = reloaded.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(after.length).toBe(unlocks.length);
    expect(after.every((e) => e.member === "Collected")).toBe(true);
    expect(SaveFile.load(reloaded.toBytes()).toBytes()).toEqual(reloaded.toBytes());
  });
});

describe("UX helpers", () => {
  it("prettifies gameplay-tag keys", () => {
    expect(prettifyKey("LeavingAreaSplines.Tricorner")).toBe("Leaving Area Splines › Tricorner");
    expect(prettifyKey("Tutorials.Basic.Move")).toBe("Tutorials › Basic › Move");
  });

  it("completeAllProgress sets progress enums to their completion value and round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    expect(sf.completeAllProgress()).toBeGreaterThan(0);
    const reloaded = SaveFile.load(sf.toBytes());
    const unlocks = reloaded.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(unlocks.every((e) => e.member === "Collected")).toBe(true);
    expect(SaveFile.load(reloaded.toBytes()).toBytes()).toEqual(reloaded.toBytes());
  });
});
