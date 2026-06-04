import { describe, it, expect } from "vitest";
import { Keystream } from "../src/crypt/index.js";
import { SaveFile } from "../src/sav/index.js";
import { enumOptions, KNOWN_ENUMS } from "../src/enums.js";
import { fx } from "./helpers.js";

const ks = new Keystream(fx("keystream-61k.bin"));

describe("enum scanning + dropdowns", () => {
  it("finds the ETtSaveGameVersion enum field", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    const e = sf.enums().find((x) => x.enumType === "ETtSaveGameVersion");
    expect(e, "ETtSaveGameVersion enum present").toBeDefined();
    expect(e!.value.startsWith("ETtSaveGameVersion::")).toBe(true);
  });

  it("builds dropdown options from known members + observed + current", () => {
    const opts = enumOptions("ETtSaveGameVersion", new Set(["Initial"]), "Initial");
    for (const m of KNOWN_ENUMS.ETtSaveGameVersion!) expect(opts).toContain(m);
  });

  it("edits an enum member safely and re-loads to the new value", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    const e = sf.enums().find((x) => x.enumType === "ETtSaveGameVersion")!;
    sf.setEnum(e, "LatestVersion");
    const reloaded = SaveFile.load(sf.toBytes(), ks);
    const e2 = reloaded.enums().find((x) => x.enumType === "ETtSaveGameVersion")!;
    expect(e2.member).toBe("LatestVersion");
    // and the save still fully round-trips (no corruption)
    expect(SaveFile.load(reloaded.toBytes(), ks).toBytes()).toEqual(reloaded.toBytes());
  });

  it("captures a distinguishing context key for duplicate enum types", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    const unlocks = sf.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(unlocks.length).toBeGreaterThan(1);
    const contexts = new Set(unlocks.map((e) => e.context));
    expect(contexts.size).toBeGreaterThan(1); // duplicates are actually distinguishable
  });

  it("bulk-sets every entry of an enum type, length-changing members and all, and re-loads cleanly", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    const unlocks = sf.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    sf.setEnumsBulk(unlocks, "Collected");
    const reloaded = SaveFile.load(sf.toBytes(), ks);
    const after = reloaded.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(after.length).toBe(unlocks.length);
    expect(after.every((e) => e.member === "Collected")).toBe(true);
    // still a clean round-trip
    expect(SaveFile.load(reloaded.toBytes(), ks).toBytes()).toEqual(reloaded.toBytes());
  });
});

import { prettifyKey } from "../src/enums.js";

describe("UX helpers", () => {
  it("prettifies gameplay-tag keys", () => {
    expect(prettifyKey("LeavingAreaSplines.Tricorner")).toBe("Leaving Area Splines › Tricorner");
    expect(prettifyKey("Tutorials.Basic.Move")).toBe("Tutorials › Basic › Move");
    expect(prettifyKey("GameFlow.RestorePoint.Default")).toBe("Game Flow › Restore Point › Default");
  });

  it("completeAllProgress sets progress enums to their completion value and round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    const changed = sf.completeAllProgress();
    expect(changed).toBeGreaterThan(0);
    const reloaded = SaveFile.load(sf.toBytes(), ks);
    // collectibles are now Collected
    const unlocks = reloaded.enums().filter((e) => e.enumType === "ETtGameProgressUnlock");
    expect(unlocks.every((e) => e.member === "Collected")).toBe(true);
    expect(SaveFile.load(reloaded.toBytes(), ks).toBytes()).toEqual(reloaded.toBytes());
  });
});
