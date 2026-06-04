import { describe, it, expect } from "vitest";
import { Keystream } from "../src/crypt/index.js";
import { SaveFile } from "../src/sav/index.js";
import { downgradeRecipe, renameRecipe, readBuildVersion } from "../src/recipes/index.js";
import { fx, hasFx, REAL_SAVES } from "./helpers.js";

const ks = new Keystream(fx("keystream-61k.bin"));

describe("SaveFile", () => {
  it("loads with a passing round-trip self-check (even partially-covered big saves)", () => {
    for (const name of REAL_SAVES) {
      const sf = SaveFile.load(fx(name), ks);
      expect(sf.isUnmodified(), name).toBe(true);
      expect(sf.toBytes(), name).toEqual(fx(name));
    }
  });

  it("reads the build version", () => {
    expect(readBuildVersion(SaveFile.load(fx("slot1_prepatch.sav"), ks))).toBe(1281204);
    if (hasFx("slot0_patched.sav")) expect(readBuildVersion(SaveFile.load(fx("slot0_patched.sav"), ks))).toBe(1283556);
  });
});

describe.skipIf(!hasFx("slot0_patched.sav"))("downgrade recipe", () => {
  it("lowers BuildVersion + changelist to the target, touching nothing else", () => {
    const original = fx("slot0_patched.sav");
    const sf = SaveFile.load(original, ks);
    downgradeRecipe.apply(sf, { targetBuildVersion: 1281204 });

    expect(readBuildVersion(sf)).toBe(1281204);
    expect(sf.doc.header.changelist).toBe(1281204);

    const out = sf.toBytes();
    expect(out.length).toBe(original.length);
    expect(readBuildVersion(SaveFile.load(out, ks))).toBe(1281204);

    const diffs = [...out].reduce((n, b, i) => n + (b !== original[i] ? 1 : 0), 0);
    expect(diffs).toBeLessThanOrEqual(8);
  });
});

describe("rename recipe", () => {
  it("changes the save name and still round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    renameRecipe.apply(sf, { name: "PRACTICE" });
    expect(sf.getField("SaveName")!.value).toBe("PRACTICE");
    expect(SaveFile.load(sf.toBytes(), ks).getField("SaveName")!.value).toBe("PRACTICE");
  });
});
