import { describe, it, expect } from "vitest";
import { SaveFile } from "../src/sav/index.js";
import { downgradeRecipe, renameRecipe, readBuildVersion } from "../src/recipes/index.js";
import { fx, hasFx, REAL_SAVES } from "./helpers.js";

describe("SaveFile", () => {
  it("loads with a passing round-trip self-check", () => {
    for (const name of REAL_SAVES) {
      const sf = SaveFile.load(fx(name));
      expect(sf.isUnmodified(), name).toBe(true);
      expect(sf.toBytes(), name).toEqual(fx(name));
    }
  });

  it("reads the build version", () => {
    expect(readBuildVersion(SaveFile.load(fx("slot1_prepatch.sav")))).toBe(1281204);
    if (hasFx("slot0_patched.sav")) expect(readBuildVersion(SaveFile.load(fx("slot0_patched.sav")))).toBe(1283556);
  });
});

describe.skipIf(!hasFx("slot0_patched.sav"))("downgrade recipe", () => {
  it("lowers BuildVersion + changelist to the target, touching nothing else", () => {
    const original = fx("slot0_patched.sav");
    const sf = SaveFile.load(original);
    downgradeRecipe.apply(sf, { targetBuildVersion: 1281204 });

    expect(readBuildVersion(sf)).toBe(1281204);
    expect(sf.doc.header.changelist).toBe(1281204);

    const out = sf.toBytes();
    expect(out.length).toBe(original.length);
    expect(readBuildVersion(SaveFile.load(out))).toBe(1281204);

    const diffs = [...out].reduce((n, b, i) => n + (b !== original[i] ? 1 : 0), 0);
    expect(diffs).toBeLessThanOrEqual(8);
  });
});

describe("setFieldAll (wallet writes to multiple denormalized fields)", () => {
  it("updates every duplicate of a field name to the given value, re-loading clean", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    sf.setFieldAll("Saved_Total", 9999n);
    const after = SaveFile.load(sf.toBytes());
    const allSavedTotal = after.fields().filter((f) => f.name === "Saved_Total");
    expect(allSavedTotal.length).toBeGreaterThan(0);
    expect(allSavedTotal.every((f) => f.value === 9999n)).toBe(true);
    // round-trips
    expect(SaveFile.load(after.toBytes()).toBytes()).toEqual(after.toBytes());
  });
});

describe("rename recipe", () => {
  it("changes the save name and still round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    renameRecipe.apply(sf, { name: "PRACTICE" });
    expect(sf.getField("SaveName")!.value).toBe("PRACTICE");
    expect(SaveFile.load(sf.toBytes()).getField("SaveName")!.value).toBe("PRACTICE");
  });
});
