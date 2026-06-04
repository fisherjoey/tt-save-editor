import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Keystream } from "../src/crypt/index.js";
import { SaveFile } from "../src/sav/index.js";
import { downgradeRecipe, renameRecipe, readBuildVersion } from "../src/recipes/index.js";

const fx = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))));
const ks = new Keystream(fx("keystream-61k.bin"));

describe("SaveFile", () => {
  it("loads with a passing round-trip self-check (even partially-covered big saves)", () => {
    for (const name of ["slot1_prepatch.sav", "slot0_patched.sav", "slot0_thirdparty_100pct.sav"]) {
      const sf = SaveFile.load(fx(name), ks);
      expect(sf.isUnmodified()).toBe(true);
      expect(sf.toBytes()).toEqual(fx(name)); // no-op === original
    }
  });

  it("reads the build version", () => {
    expect(readBuildVersion(SaveFile.load(fx("slot0_patched.sav"), ks))).toBe(1283556);
    expect(readBuildVersion(SaveFile.load(fx("slot1_prepatch.sav"), ks))).toBe(1281204);
  });
});

describe("downgrade recipe", () => {
  it("lowers BuildVersion + changelist to the target, touching nothing else", () => {
    const original = fx("slot0_patched.sav");
    const sf = SaveFile.load(original, ks);
    downgradeRecipe.apply(sf, { targetBuildVersion: 1281204 });

    expect(readBuildVersion(sf)).toBe(1281204);
    expect(sf.doc.header.changelist).toBe(1281204);

    const out = sf.toBytes();
    expect(out.length).toBe(original.length); // progress untouched, same size
    // re-load the edited save and confirm it parses cleanly with the new value
    const reloaded = SaveFile.load(out, ks);
    expect(readBuildVersion(reloaded)).toBe(1281204);

    // only a handful of bytes changed (BuildVersion u32 + changelist u32)
    const diffs = [...out].reduce((n, b, i) => n + (b !== original[i] ? 1 : 0), 0);
    expect(diffs).toBeLessThanOrEqual(8);
  });
});

describe("rename recipe", () => {
  it("changes the save name and still round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"), ks);
    renameRecipe.apply(sf, { name: "PRACTICE" });
    expect(sf.getField("SaveName")!.value).toBe("PRACTICE");
    // edited save re-loads cleanly
    expect(SaveFile.load(sf.toBytes(), ks).getField("SaveName")!.value).toBe("PRACTICE");
  });
});
