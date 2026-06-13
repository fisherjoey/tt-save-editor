import { COLLECTIBLES as GENERATED } from "./data/collectibles.generated.js";
import { ISLANDS, DISTRICTS } from "./data/collectibles-mapping.js";

export type Confidence = "high" | "med" | "low";

export interface CollectibleFacets {
  source: "story" | "hub" | "shop" | "other";
  chapter?: number;
  mission?: number;
  island?: string;
  district?: string;
  /** Hub sub-area when not an island/district (e.g. "MilestoneRewards"). */
  area?: string;
}

export interface CollectibleTag {
  tag: string;
  name: string;
  confidence: Confidence;
  facets: CollectibleFacets;
}

export interface CollectibleCounter {
  key: string;
  label: string;
  /** In-game /N denominator (== tags.length). */
  counter: number;
  /** Confirmed in-game (gold bricks). Others are untested. */
  verified: boolean;
  /** Enum value written when inserting one of these (e.g. "ETtCollectableGameProgressState::Collected"). */
  stateValue: string;
  tags: CollectibleTag[];
}

/** The committed, generated catalogue the UI consumes. */
export const COLLECTIBLES: CollectibleCounter[] = GENERATED;

/** What a given gameplay tag is, looked up from the catalogue. */
export interface CollectibleRef {
  /** Counter key, e.g. "GoldBricks". */
  key: string;
  /** Counter label, e.g. "Gold bricks". */
  label: string;
  /** This entry's in-game name, e.g. "Iceberg Lounge (Ch.1 M5) — Gold Brick #1". */
  name: string;
  verified: boolean;
}

let _index: Map<string, CollectibleRef> | null = null;

/** Tag → catalogue info, so any panel can label/group a raw entry by its real
 *  collectible category instead of its bare enum type. Built once, then cached. */
export function collectibleIndex(): Map<string, CollectibleRef> {
  if (_index) return _index;
  const m = new Map<string, CollectibleRef>();
  for (const c of COLLECTIBLES) {
    for (const t of c.tags) m.set(t.tag, { key: c.key, label: c.label, name: t.name, verified: c.verified });
  }
  _index = m;
  return m;
}

export function normalizeConfidence(c: string): Confidence {
  if (c === "medium") return "med";
  if (c === "high" || c === "med" || c === "low") return c;
  return "low";
}

/** Fallback display name from a tag (drops the GameProgress.Definitions prefix). */
export function prettifyTagPath(tag: string): string {
  const rest = tag.replace(/^GameProgress\.Definitions\./, "");
  return rest
    .split(".")
    .map((seg) => seg.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .join(" › ");
}

/** Parse grouping facets from a tag (drives the panel's "View by" switcher). */
export function deriveFacets(tag: string): CollectibleFacets {
  if (tag.includes(".ShopItems.")) return { source: "shop" };
  const story = tag.match(/\.Story\.(\d+)\.(\d+)\./);
  if (story) return { source: "story", chapter: Number(story[1]), mission: Number(story[2]) };
  if (tag.includes(".Hub.")) {
    const seg = tag.match(/\.Hub\.([A-Za-z0-9]+)(?:\.([A-Za-z0-9]+))?/);
    const seg1 = seg?.[1];
    const seg2 = seg?.[2];
    if (seg1 && ISLANDS[seg1]) {
      const island = ISLANDS[seg1];
      const district = seg2 ? DISTRICTS[seg2] : undefined;
      return {
        source: "hub",
        island,
        ...(district ? { district } : seg2 ? { area: seg2 } : {}),
      };
    }
    // Hub, but organised by sub-area rather than island (e.g. MilestoneRewards).
    return { source: "hub", ...(seg1 ? { area: seg1 } : {}) };
  }
  return { source: "other" };
}

/** Select the tags for a counter: matches any include prefix, minus excludes. */
export function selectCounterTags(
  universe: string[],
  m: { include: string[]; exclude?: string[] },
): string[] {
  const ex = m.exclude ?? [];
  return universe.filter(
    (t) => m.include.some((p) => t.startsWith(p)) && !ex.some((p) => t === p || t.startsWith(p)),
  );
}
