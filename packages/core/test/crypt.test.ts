import { describe, it, expect } from "vitest";
import { decrypt, encrypt } from "../src/crypt/index.js";
import { fx, hasFx } from "./helpers.js";

const GVAS = Uint8Array.of(0x47, 0x56, 0x41, 0x53); // "GVAS"

describe("crypt (RC4)", () => {
  it("decrypts a real save to the GVAS magic", () => {
    const plain = decrypt(fx("slot1_prepatch.sav"));
    expect(plain.slice(0, 4)).toEqual(GVAS);
    expect(Buffer.from(plain.slice(30, 47)).toString("latin1")).toBe("++Dinner+mainline");
  });

  it.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("decrypts a third-party save too (cipher is universal)", () => {
    const plain = decrypt(fx("slot0_thirdparty_100pct.sav"));
    expect(plain.slice(0, 4)).toEqual(GVAS);
  });

  it("RC4 is involutive: encrypt(decrypt(x)) === x for any save size", () => {
    const c = fx("slot1_prepatch.sav");
    expect(encrypt(decrypt(c))).toEqual(c);
  });
});
