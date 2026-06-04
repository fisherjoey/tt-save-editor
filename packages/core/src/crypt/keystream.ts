/**
 * The save obfuscation is a byte-wise XOR against a FIXED keystream ("the pad")
 * that is identical for every copy of the game. One captured pad decrypts/encrypts
 * any user's save. This module wraps that pad and guards against using it past its
 * captured length (which would silently corrupt the tail of a save).
 */

/** First four keystream bytes, recovered from the known "GVAS" magic. A captured
 *  pad MUST start with these or it isn't the real game pad. */
export const KEYSTREAM_ANCHOR = Uint8Array.of(0xa5, 0xdf, 0x38, 0xe8);

export class Keystream {
  readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get length(): number {
    return this.bytes.length;
  }

  /** True if this pad begins with the known anchor (sanity check on any pad we load). */
  isValid(): boolean {
    if (this.bytes.length < KEYSTREAM_ANCHOR.length) return false;
    return KEYSTREAM_ANCHOR.every((b, i) => this.bytes[i] === b);
  }

  /** Whether this pad can fully cover a payload of `byteLength`. */
  covers(byteLength: number): boolean {
    return byteLength <= this.bytes.length;
  }
}
