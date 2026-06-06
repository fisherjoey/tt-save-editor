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

  it("dropdown options are filtered to same byte length as the current member (interim safety)", () => {
    // ETtGameProgressUnlock: Locked(6), Unlocked(8), Collected(9) — all different lengths
    const fromLocked = enumOptions("ETtGameProgressUnlock", new Set(), "Locked");
    const fromUnlocked = enumOptions("ETtGameProgressUnlock", new Set(), "Unlocked");
    const fromCollected = enumOptions("ETtGameProgressUnlock", new Set(), "Collected");
    expect(fromLocked).toEqual(["Locked"]);
    expect(fromUnlocked).toEqual(["Unlocked"]);
    expect(fromCollected).toEqual(["Collected"]);
    // ETtChallengeGameProgressState: Locked(6), Unlocked(8), Completed(9), Rewarded(8)
    // From Unlocked you should be able to reach Rewarded (both 8 chars)
    const fromChallengeUnlocked = enumOptions("ETtChallengeGameProgressState", new Set(), "Unlocked");
    expect(fromChallengeUnlocked).toContain("Unlocked");
    expect(fromChallengeUnlocked).toContain("Rewarded");
    expect(fromChallengeUnlocked).not.toContain("Locked");
    expect(fromChallengeUnlocked).not.toContain("Completed");
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
