import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Keystream, decrypt, encrypt } from "../src/crypt/index.js";
import { parse, serialize, scanFields, findField, setFixedValue } from "../src/gvas/index.js";

const fx = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))));
const ks = new Keystream(fx("keystream-61k.bin"));

describe("gvas header + body", () => {
  it("parses the real save header", () => {
    const doc = parse(decrypt(fx("slot1_prepatch.sav"), ks, { allowPartial: true }));
    expect(doc.header.branch).toBe("++Dinner+mainline");
    expect(doc.header.saveGameClassName).toBe("/Script/TtSaveSystem.TtSaveGame");
    expect(doc.header.engineMajor).toBe(5);
    expect(doc.header.engineMinor).toBe(6);
  });

  it("BYTE-IDENTICAL round-trip on every real save (the safety net)", () => {
    for (const name of ["slot1_prepatch.sav", "slot0_patched.sav", "slot0_thirdparty_100pct.sav"]) {
      const plain = decrypt(fx(name), ks, { allowPartial: true });
      const out = serialize(parse(plain));
      expect(out.length, `${name} length`).toBe(plain.length);
      expect(out, `${name} bytes`).toEqual(plain);
    }
  });

  it("full pipeline no-op is byte-identical: encrypt(serialize(parse(decrypt(f)))) === f", () => {
    const c = fx("slot1_prepatch.sav");
    const plain = decrypt(c, ks, { allowPartial: true });
    const out = encrypt(serialize(parse(plain)), ks, { allowPartial: true });
    expect(out).toEqual(c);
  });
});

describe("scanner", () => {
  it("finds BuildVersion by name (not offset) and decodes it", () => {
    const doc = parse(decrypt(fx("slot1_prepatch.sav"), ks, { allowPartial: true }));
    const fields = scanFields(doc.body);
    const bv = findField(fields, "BuildVersion");
    expect(bv?.type).toBe("UInt32Property");
    expect(bv?.value).toBe(1281204); // pre-patch build
  });

  it("finds the same BuildVersion field in a THIRD-PARTY save (by name, robust to layout shift)", () => {
    const doc = parse(decrypt(fx("slot0_thirdparty_100pct.sav"), ks, { allowPartial: true }));
    const bv = findField(scanFields(doc.body), "BuildVersion");
    expect(bv?.type).toBe("UInt32Property");
    expect(typeof bv?.value).toBe("number");
  });

  it("editing a field changes only its value bytes and re-scans to the new value", () => {
    const plain = decrypt(fx("slot1_prepatch.sav"), ks, { allowPartial: true });
    const doc = parse(plain);
    const bv = findField(scanFields(doc.body), "BuildVersion")!;
    doc.body = setFixedValue(doc.body, bv, 999);
    const out = serialize(doc);
    const diffs = [...out].reduce((n, b, i) => n + (b !== plain[i] ? 1 : 0), 0);
    expect(diffs).toBeLessThanOrEqual(4); // only the UInt32
    expect(findField(scanFields(parse(out).body), "BuildVersion")!.value).toBe(999);
  });
});
