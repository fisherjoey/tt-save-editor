import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Keystream, decrypt, encrypt, KeystreamTooShortError, KEYSTREAM_ANCHOR } from "../src/crypt/index.js";

const fx = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))));

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

  it("decrypts a THIRD-PARTY save too (pad is universal)", () => {
    const plain = decrypt(fx("slot0_thirdparty_100pct.sav"), ks, { allowPartial: true });
    expect(plain.slice(0, 4)).toEqual(GVAS);
    // branch string ++Dinner+mainline at offset 30 confirms it is really this game's GVAS
    expect(Buffer.from(plain.slice(30, 47)).toString("latin1")).toBe("++Dinner+mainline");
  });

  it("XOR is involutive: encrypt(decrypt(x)) === x", () => {
    const c = fx("slot1_prepatch.sav").slice(0, ks.length);
    expect(encrypt(decrypt(c, ks), ks)).toEqual(c);
  });

  it("refuses to operate past pad length by default (no silent corruption)", () => {
    const big = fx("slot0_thirdparty_100pct.sav"); // 1.5 MB > 61 KB pad
    expect(() => decrypt(big, ks)).toThrow(KeystreamTooShortError);
  });

  it("allowPartial passes the uncovered tail through unchanged", () => {
    const big = fx("slot0_thirdparty_100pct.sav");
    const plain = decrypt(big, ks, { allowPartial: true });
    expect(plain.length).toBe(big.length);
    // beyond the pad, ciphertext is copied through verbatim
    expect(plain.slice(ks.length)).toEqual(big.slice(ks.length));
  });
});
