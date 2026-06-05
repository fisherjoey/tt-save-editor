import { describe, it, expect } from "vitest";
import { decrypt, encrypt } from "../src/crypt/index.js";
import { parse, serialize, scanFields, findField, setFixedValue } from "../src/gvas/index.js";
import { fx, hasFx, REAL_SAVES } from "./helpers.js";

describe("gvas header + body", () => {
  it("parses the real save header", () => {
    const doc = parse(decrypt(fx("slot1_prepatch.sav")));
    expect(doc.header.branch).toBe("++Dinner+mainline");
    expect(doc.header.saveGameClassName).toBe("/Script/TtSaveSystem.TtSaveGame");
    expect(doc.header.engineMajor).toBe(5);
    expect(doc.header.engineMinor).toBe(6);
  });

  it("BYTE-IDENTICAL round-trip on every available real save (the safety net)", () => {
    for (const name of REAL_SAVES) {
      const plain = decrypt(fx(name));
      const out = serialize(parse(plain));
      expect(out.length, `${name} length`).toBe(plain.length);
      expect(out, `${name} bytes`).toEqual(plain);
    }
  });

  it("full pipeline no-op is byte-identical: encrypt(serialize(parse(decrypt(f)))) === f", () => {
    const c = fx("slot1_prepatch.sav");
    expect(encrypt(serialize(parse(decrypt(c))))).toEqual(c);
  });
});

describe("scanner", () => {
  it("finds BuildVersion by name (not offset) and decodes it", () => {
    const doc = parse(decrypt(fx("slot1_prepatch.sav")));
    const bv = findField(scanFields(doc.body), "BuildVersion");
    expect(bv?.type).toBe("UInt32Property");
    expect(bv?.value).toBe(1281204);
  });

  it.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("finds BuildVersion in a third-party save (robust to layout shift)", () => {
    const doc = parse(decrypt(fx("slot0_thirdparty_100pct.sav")));
    const bv = findField(scanFields(doc.body), "BuildVersion");
    expect(bv?.type).toBe("UInt32Property");
    expect(typeof bv?.value).toBe("number");
  });

  it("editing a field changes only its value bytes and re-scans to the new value", () => {
    const plain = decrypt(fx("slot1_prepatch.sav"));
    const doc = parse(plain);
    const bv = findField(scanFields(doc.body), "BuildVersion")!;
    doc.body = setFixedValue(doc.body, bv, 999);
    const out = serialize(doc);
    const diffs = [...out].reduce((n, b, i) => n + (b !== plain[i] ? 1 : 0), 0);
    expect(diffs).toBeLessThanOrEqual(4);
    expect(findField(scanFields(parse(out).body), "BuildVersion")!.value).toBe(999);
  });
});
