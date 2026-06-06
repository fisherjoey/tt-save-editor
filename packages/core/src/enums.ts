/**
 * Known enum member lists, so a dropdown can show every valid option even when a
 * save only contains one. Data-driven and community-extensible (like recipes) —
 * add an entry when you map an enum's members. Anything not listed here still gets
 * a dropdown built from the members observed in the save.
 */
export const KNOWN_ENUMS: Record<string, string[]> = {
  // Member lists extracted from the game's reflection data.
  EDifficultySetting: ["Normal", "Medium", "Hard"],
  ETtChallengeGameProgressState: ["Locked", "Unlocked", "Completed", "Rewarded"],
  ETtGameProgressUnlock: ["Locked", "Unlocked", "Collected"],
  ETtMissionGameProgress: ["Locked", "Unlocked", "InProgress", "Complete"],
  ETtObjectivesNodeGameProgress: ["Locked", "InProgress", "Complete"],
  ETtPlayGoInstallState: ["Unknown", "InitialChunkOnly", "Complete"],
  ETtSaveGameVersion: ["NoVersion", "Initial", "LatestVersion", "UnknownVersion", "VersionCount"],
  ETtSaveSlotValidationState: ["Unknown", "Validated", "Invalidated"],
};

/**
 * Options for an enum dropdown: known members ∪ members seen in the save ∪ current.
 * As of v0.1.2 the structure walker tracks every container's Size field, so
 * different-byte-length swaps (Locked ↔ Collected, etc.) are safe — setStringValue
 * splices and bumps every ancestor container's Size by Δ.
 */
export function enumOptions(enumType: string, observed: Set<string> | undefined, current: string): string[] {
  const all = new Set<string>(KNOWN_ENUMS[enumType] ?? []);
  observed?.forEach((m) => all.add(m));
  all.add(current);
  return [...all];
}

export type EnumCategory = "progress" | "settings" | "system";

export interface EnumMeta {
  /** Human-friendly title for this enum type. */
  title: string;
  category: EnumCategory;
  /** A sensible "complete it" value for the bulk action, when there is one. */
  completeValue?: string;
}

/** Friendly names + grouping so non-technical users see "Collectibles", not "ETtGameProgressUnlock". */
export const ENUM_META: Record<string, EnumMeta> = {
  ETtGameProgressUnlock: { title: "Collectibles & unlocks", category: "progress", completeValue: "Collected" },
  ETtChallengeGameProgressState: { title: "Challenges", category: "progress", completeValue: "Completed" },
  ETtMissionGameProgress: { title: "Missions", category: "progress", completeValue: "Complete" },
  ETtObjectivesNodeGameProgress: { title: "Objectives", category: "progress", completeValue: "Complete" },
  EDifficultySetting: { title: "Difficulty", category: "settings" },
  ETtSaveGameVersion: { title: "Save version", category: "system" },
  ETtSaveSlotValidationState: { title: "Save validation", category: "system" },
  ETtPlayGoInstallState: { title: "Install state", category: "system" },
  E_LowHighResEras: { title: "Resolution era", category: "system" },
};

export function enumMeta(enumType: string): EnumMeta {
  return ENUM_META[enumType] ?? { title: enumType.replace(/^E_?/, ""), category: "system" };
}

export const CATEGORY_LABELS: Record<EnumCategory, string> = {
  progress: "Progress & unlocks",
  settings: "Settings",
  system: "System (advanced)",
};

/** Turn a raw gameplay-tag key into a readable label, e.g.
 *  "LeavingAreaSplines.Tricorner" -> "Leaving Area Splines › Tricorner". */
export function prettifyKey(key: string): string {
  return key
    .split(".")
    .map((seg) =>
      seg
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim(),
    )
    .filter(Boolean)
    .join(" › ");
}

