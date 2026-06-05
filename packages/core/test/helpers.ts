import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

export const fx = (name: string): Uint8Array => new Uint8Array(readFileSync(dir(name)));
export const hasFx = (name: string): boolean => existsSync(dir(name));

/**
 * Real save fixtures. The maintainer's own minimal save is committed so the
 * round-trip safety net runs in CI. Larger / third-party saves are optional:
 * drop them into test/fixtures/ locally for extra coverage; tests skip them
 * when absent (so CI passes without redistributing anyone else's save).
 */
export const REAL_SAVES = ["slot1_prepatch.sav", "slot0_patched.sav", "slot0_thirdparty_100pct.sav"].filter(hasFx);
