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
}

export const FEATURED_FIELDS: FeaturedField[] = [
  {
    name: "StudsCollected",
    label: "Studs",
    help: "Total stud wallet — writes StudsCollected and Saved_Total together",
    linkedNames: ["Saved_Total"],
  },
];
