/**
 * Save crypto: RC4 with a 32-byte key hardcoded into the game. RC4 is involutive
 * with the same key, so `decrypt` and `encrypt` are the same operation.
 *
 * The cipher key was reverse-engineered out of the game executable by RealDarkCraft
 * (https://github.com/RealDarkCraft/LEGO-Batman-Legacy-of-the-Dark-Knight---Save-decryptor) —
 * huge credit to them. Using it here removes the keystream-pad dance, lets the
 * editor decrypt any save of any size, and shrinks the bundle by 1.5 MB.
 */

// 32-byte RC4 key from the game's `save_crypt` routine.
const KEY = new Uint8Array([
  0x21, 0x38, 0x11, 0x60, 0x17, 0x47, 0x2f, 0x53, 0x5d, 0x37, 0x24, 0x0e, 0x0e, 0x0f, 0x60, 0x43,
  0x2f, 0x0e, 0x3f, 0x0a, 0x27, 0x55, 0x4b, 0x0b, 0x4f, 0x59, 0x25, 0x38, 0x0b, 0x3a, 0x44, 0x17,
]);

function rc4(data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + (S[i] as number) + (KEY[i % KEY.length] as number)) & 0xff;
    const t = S[i] as number;
    S[i] = S[j] as number;
    S[j] = t;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + (S[i] as number)) & 0xff;
    const t = S[i] as number;
    S[i] = S[j] as number;
    S[j] = t;
    out[n] = (data[n] as number) ^ (S[((S[i] as number) + (S[j] as number)) & 0xff] as number);
  }
  return out;
}

export const decrypt = rc4;
export const encrypt = rc4;
