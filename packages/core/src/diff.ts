import { readEnumArrayEntries, scanFields } from "./gvas/scan.js";

export interface AddedEntry {
  tag: string;
  /** "EnumType::Member" — identifies what kind of entry it is. */
  state: string;
}
export interface StateChange {
  tag: string;
  from: string;
  to: string;
}
export interface ScalarChange {
  name: string;
  from: string;
  to: string;
}
export interface SaveChanges {
  /** Array entries present in `after` but not `before` (added collectibles/missions/objectives). */
  added: AddedEntry[];
  /** Array entries in both, whose enum member changed (e.g. a mission flipped to Complete). */
  stateChanged: StateChange[];
  /** Named scalar fields (studs, playtime, …) whose value changed. */
  scalars: ScalarChange[];
}

/** Per-name value map; a name that appears more than once maps to null (ambiguous, skip). */
function uniqueScalarValues(body: Uint8Array): Map<string, string | null> {
  const seen = new Map<string, string | null>();
  for (const f of scanFields(body)) seen.set(f.name, seen.has(f.name) ? null : String(f.value));
  return seen;
}

/**
 * What changed between two decrypted save bodies — the basis for the "what you
 * changed" recap, change-preview, before/after, and broken-vs-working comparisons.
 * Compares the SavedGameProgressEnumValues array (added entries + state flips) and
 * uniquely-named scalar fields. Presence is by real array tag (not the scanEnums
 * heuristic), so it's accurate.
 */
export function summarizeChanges(before: Uint8Array, after: Uint8Array): SaveChanges {
  const beforeMap = new Map(readEnumArrayEntries(before).map((e) => [e.tag, e.state]));
  const added: AddedEntry[] = [];
  const stateChanged: StateChange[] = [];
  for (const e of readEnumArrayEntries(after)) {
    const b = beforeMap.get(e.tag);
    if (b === undefined) added.push({ tag: e.tag, state: e.state });
    else if (b !== e.state) stateChanged.push({ tag: e.tag, from: b, to: e.state });
  }

  const fb = uniqueScalarValues(before);
  const fa = uniqueScalarValues(after);
  const scalars: ScalarChange[] = [];
  for (const [name, av] of fa) {
    if (av === null) continue;
    const bv = fb.get(name);
    if (bv != null && bv !== av) scalars.push({ name, from: bv, to: av });
  }

  return { added, stateChanged, scalars };
}

/** True if anything changed at all. */
export function hasChanges(c: SaveChanges): boolean {
  return c.added.length > 0 || c.stateChanged.length > 0 || c.scalars.length > 0;
}
