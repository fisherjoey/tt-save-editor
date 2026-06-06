import { COLLECTIBLES as GENERATED } from "./data/collectibles.generated.js";
import { ISLANDS, DISTRICTS } from "./data/collectibles-mapping.js";

export type Confidence = "high" | "med" | "low";

export interface CollectibleFacets {
  source: "story" | "hub" | "shop" | "other";
  chapter?: number;
  mission?: number;
  island?: string;
  district?: string;
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
  const hub = tag.match(/\.Hub\.([A-Z]+)\.([A-Z0-9]+)\./);
  if (hub) {
    const island = ISLANDS[hub[1]!];
    const district = DISTRICTS[hub[2]!];
    return { source: "hub", ...(island ? { island } : {}), ...(district ? { district } : {}) };
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
