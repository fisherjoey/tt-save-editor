import { describe, it, expect } from "vitest";
import { Keystream, decrypt, encrypt, KeystreamTooShortError, KEYSTREAM_ANCHOR } from "../src/crypt/index.js";
import { fx, hasFx } from "./helpers.js";

const GVAS = Uint8Array.of(0x47, 0x56, 0x41, 0x53); // "GVAS"
const ks = new Keystream(fx("keystream-61k.bin"));

describe("crypt", () => {
  it("the captured pad is the real game pad (anchor matches)", () => {
    expect(ks.isValid()).toBe(true);
    expect(ks.bytes.slice(0, 4)).toEqual(KEYSTREAM_ANCHOR);
  });

  it("decrypts a real save to the GVAS magic", () => {
    const plain = decrypt(fx("slot1_prepatch.sav"), ks, { allowPartial: true });
    expect(plain.slice(0, 4)).toEqual(GVAS);
  });

  it.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("decrypts a THIRD-PARTY save too (pad is universal)", () => {
    const plain = decrypt(fx("slot0_thirdparty_100pct.sav"), ks, { allowPartial: true });
    expect(plain.slice(0, 4)).toEqual(GVAS);
    expect(Buffer.from(plain.slice(30, 47)).toString("latin1")).toBe("++Dinner+mainline");
  });

  it("XOR is involutive: encrypt(decrypt(x)) === x", () => {
    const c = fx("slot1_prepatch.sav").slice(0, ks.length);
    expect(encrypt(decrypt(c, ks), ks)).toEqual(c);
  });

  it("refuses to operate past pad length by default (no silent corruption)", () => {
    const big = new Uint8Array(ks.length + 5000).fill(0x11); // larger than the 61 KB pad
    expect(() => decrypt(big, ks)).toThrow(KeystreamTooShortError);
  });

  it("allowPartial passes the uncovered tail through unchanged", () => {
    const big = new Uint8Array(ks.length + 5000).fill(0x11);
    const plain = decrypt(big, ks, { allowPartial: true });
    expect(plain.length).toBe(big.length);
    expect(plain.slice(ks.length)).toEqual(big.slice(ks.length));
  });
});
