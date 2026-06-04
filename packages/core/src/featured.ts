/**
 * High-value fields surfaced as friendly, prominent "quick edits" (e.g. Studs),
 * instead of making people hunt through the raw field list. Data-driven and
 * community-extensible — add an entry as fields get mapped.
 */
export interface FeaturedField {
  /** The exact property name in the save. */
  name: string;
  /** Friendly label shown to the user. */
  label: string;
  help?: string;
}

export const FEATURED_FIELDS: FeaturedField[] = [
  { name: "StudsCollected", label: "Studs", help: "Total studs collected" },
];
