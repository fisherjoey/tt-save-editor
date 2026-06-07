/**
 * High-value fields surfaced as friendly, prominent "quick edits" (e.g. Studs),
 * instead of making people hunt through the raw field list. Data-driven and
 * community-extensible — add an entry as fields get mapped.
 */
export interface FeaturedField {
  /** The exact property name in the save (used for finding the current value to display). */
  name: string;
  /** Friendly label shown to the user. */
  label: string;
  help?: string;
  /** Additional field names that must be written to the SAME value in lockstep.
   *  Some games store the wallet in multiple denormalized places — they must all
   *  match or the game ignores the edit. For studs the game uses Saved_Total as
   *  the load-time source of truth and rewrites StudsCollected from it on save,
   *  so we have to set both (and any duplicates of either) together. */
  linkedNames?: string[];
  /** Display/parse unit. For Timespan-typed fields the raw value is 100ns ticks
   *  (`Int64` underneath), which is awful to type. `minutes` shows/accepts whole
   *  minutes; `hms` shows/accepts `H:MM:SS` (sub-minute precision); the editor
   *  converts both directions. */
  unit?: "raw" | "minutes" | "hms";
}

export const FEATURED_FIELDS: FeaturedField[] = [
  {
    name: "StudsCollected",
    label: "Studs",
    help: "Total stud wallet — writes StudsCollected and Saved_Total together",
    linkedNames: ["Saved_Total"],
  },
  {
    name: "TotalPlaytime",
    label: "Playtime",
    help: "Total playtime as H:MM:SS (UE Timespan, stored as 100ns ticks internally)",
    unit: "hms",
  },
];

const TICKS_PER_SEC = 10_000_000n;

/** Convert a raw field value (as it appears in the save) to its display value. */
export function toDisplay(value: number | bigint | boolean | string, unit?: FeaturedField["unit"]): string {
  if (unit === "minutes") {
    const ticks = typeof value === "bigint" ? value : BigInt(Number(value) | 0);
    return String(Number(ticks / 600_000_000n));
  }
  if (unit === "hms") {
    const ticks = typeof value === "bigint" ? value : BigInt(Number(value) | 0);
    const total = Number(ticks / TICKS_PER_SEC);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return String(value);
}

/** Convert a user-entered string to the raw value to write into the save. */
export function fromDisplay(input: string, unit?: FeaturedField["unit"]): bigint | number | string | boolean {
  if (unit === "minutes") {
    const m = Number(input);
    if (!Number.isFinite(m) || m < 0) throw new Error("Playtime must be a non-negative number of minutes");
    return BigInt(Math.round(m)) * 600_000_000n;
  }
  if (unit === "hms") {
    const parts = input.trim().split(":").map((p) => Number(p));
    if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) {
      throw new Error("Playtime must look like H:MM:SS (or M:SS, or a number of seconds)");
    }
    let sec = 0;
    if (parts.length === 3) sec = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    else if (parts.length === 2) sec = parts[0]! * 60 + parts[1]!;
    else sec = parts[0]!;
    return BigInt(Math.round(sec)) * TICKS_PER_SEC;
  }
  return input;
}
