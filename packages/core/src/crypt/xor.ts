import { Keystream } from "./keystream.js";

export class KeystreamTooShortError extends Error {
  constructor(
    readonly needed: number,
    readonly available: number,
  ) {
    super(
      `Save needs ${needed} keystream bytes but the pad only has ${available}. ` +
        `Use a longer pad (self-capture) to edit this save.`,
    );
    this.name = "KeystreamTooShortError";
  }
}

/**
 * XOR is its own inverse, so decrypt and encrypt are the same operation. We keep
 * two named exports for call-site clarity. By default we REQUIRE the pad to cover
 * the whole payload — partial coverage would corrupt the uncovered tail.
 */
function xor(data: Uint8Array, ks: Keystream, allowPartial: boolean): Uint8Array {
  if (!allowPartial && !ks.covers(data.length)) {
    throw new KeystreamTooShortError(data.length, ks.length);
  }
  const n = Math.min(data.length, ks.length);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < n; i++) out[i] = data[i]! ^ ks.bytes[i]!;
  // If partial is allowed, the uncovered tail is copied through unchanged.
  if (allowPartial && data.length > n) out.set(data.subarray(n), n);
  return out;
}

export function decrypt(cipher: Uint8Array, ks: Keystream, opts?: { allowPartial?: boolean }): Uint8Array {
  return xor(cipher, ks, opts?.allowPartial ?? false);
}

export function encrypt(plain: Uint8Array, ks: Keystream, opts?: { allowPartial?: boolean }): Uint8Array {
  return xor(plain, ks, opts?.allowPartial ?? false);
}
