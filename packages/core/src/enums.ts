/**
 * Known enum member lists, so a dropdown can show every valid option even when a
 * save only contains one. Data-driven and community-extensible (like recipes) —
 * add an entry when you map an enum's members. Anything not listed here still gets
 * a dropdown built from the members observed in the save.
 */
export const KNOWN_ENUMS: Record<string, string[]> = {
  // Member lists union'd from the game's reflection data and observed across real
  // saves (including a 100%-completion save). Conservative — only members we've
  // actually seen used, plus the canonical Locked default for "state" enums where
  // it's the obvious starting point.

  EDifficultySetting: ["Normal", "Medium", "Hard"],

  // Collectible / progress states
  ETtGameProgressUnlock: ["Locked", "Unlocked", "Collected"],
  ETtGameProgressState: ["Locked", "StartedOrUnlocked", "Complete"],
  ETtCollectableGameProgressState: ["Locked", "Unlocked", "Collected", "Consumed"],

  // Missions / objectives
  ETtMissionGameProgress: ["Locked", "Unlocked", "InProgress", "Complete"],
  ETtObjectivesNodeGameProgress: ["Locked", "InProgress", "Complete"],

  // Challenges / minigames
  ETtChallengeGameProgressState: ["Locked", "Unlocked", "Completed", "Rewarded"],
  ETtChallengeMinigameGameProgressState: ["Locked", "Unlocked", "CompletedGold"],

  // Shops / upgrades / customization
  EShopGameProgressState: ["Locked", "Unlocked", "Visited"],
  EDinnerUpgradeGameProgressState: ["Locked", "Unlocked", "Purchased"],
  ETtAreaCustomizationItemGameProgressState: ["Locked", "Unlocked", "Purchased"],

  // Characters / purple studs
  EDinnerCharacterGameProgressState: ["Locked", "Unlocked", "Viewed"],
  EPurpleStudGameProgressState: ["Locked", "Unlocked", "Collected"],

  // System / metadata
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

/**
 * Plain-language labels for raw enum members — what a non-technical player sees in
 * dropdowns and the change recap. The stored value stays the raw member; only the
 * displayed text changes. A per-enum override wins over the shared default; anything
 * unmapped falls back to spaced words (so "InProgress" → "In progress").
 */
const MEMBER_LABEL_DEFAULT: Record<string, string> = {
  Locked: "Locked",
  Unlocked: "Available",
  StartedOrUnlocked: "Started",
  InProgress: "Started",
  Complete: "Done",
  Completed: "Done",
  Collected: "Collected",
  Consumed: "Used up",
  Rewarded: "Done (reward claimed)",
  CompletedGold: "Gold medal",
  Visited: "Visited",
  Purchased: "Purchased",
  Viewed: "Viewed",
  Validated: "Valid",
  Invalidated: "Marked invalid",
};
const MEMBER_LABEL_BY_ENUM: Record<string, Record<string, string>> = {
  ETtCollectableGameProgressState: { Locked: "Not collected", Unlocked: "Available", Collected: "Collected (done)", Consumed: "Used up" },
  ETtGameProgressUnlock: { Locked: "Not collected", Unlocked: "Available", Collected: "Collected (done)" },
  ETtMissionGameProgress: { Locked: "Locked", Unlocked: "Available", InProgress: "Started", Complete: "Done" },
  ETtObjectivesNodeGameProgress: { Locked: "Locked", InProgress: "Started", Complete: "Done" },
  ETtGameProgressState: { Locked: "Locked", StartedOrUnlocked: "Started", Complete: "Done" },
  ETtChallengeGameProgressState: { Locked: "Locked", Unlocked: "Available", Completed: "Done", Rewarded: "Done (reward claimed)" },
  ETtChallengeMinigameGameProgressState: { Locked: "Locked", Unlocked: "Available", CompletedGold: "Gold medal" },
};

/** The text a user should see for an enum member, e.g. ("ETtMissionGameProgress","Complete") → "Done". */
export function enumMemberLabel(enumType: string, member: string): string {
  return MEMBER_LABEL_BY_ENUM[enumType]?.[member] ?? MEMBER_LABEL_DEFAULT[member] ?? prettifyKey(member);
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
  ETtCollectableGameProgressState: { title: "Collectibles", category: "progress", completeValue: "Collected" },
  ETtGameProgressState: { title: "General progress", category: "progress", completeValue: "Complete" },
  ETtChallengeGameProgressState: { title: "Challenges", category: "progress", completeValue: "Completed" },
  ETtChallengeMinigameGameProgressState: { title: "Minigames", category: "progress", completeValue: "CompletedGold" },
  ETtMissionGameProgress: { title: "Missions", category: "progress", completeValue: "Complete" },
  ETtObjectivesNodeGameProgress: { title: "Objectives", category: "progress", completeValue: "Complete" },
  EShopGameProgressState: { title: "Shop items", category: "progress", completeValue: "Visited" },
  EDinnerUpgradeGameProgressState: { title: "Upgrades", category: "progress", completeValue: "Purchased" },
  EDinnerCharacterGameProgressState: { title: "Characters", category: "progress", completeValue: "Viewed" },
  EPurpleStudGameProgressState: { title: "Purple studs", category: "progress", completeValue: "Collected" },
  ETtAreaCustomizationItemGameProgressState: { title: "Area customization", category: "progress", completeValue: "Purchased" },
  EDifficultySetting: { title: "Difficulty", category: "settings" },
  ETtSaveGameVersion: { title: "Save version", category: "system" },
  ETtSaveSlotValidationState: { title: "Save validation", category: "system" },
  ETtPlayGoInstallState: { title: "Install state", category: "system" },
  E_LowHighResEras: { title: "Resolution era", category: "system" },
};

export function enumMeta(enumType: string): EnumMeta {
  // Unmapped enums get a spaced-out title (not raw CamelCase) and land in System.
  return ENUM_META[enumType] ?? { title: prettifyKey(enumType.replace(/^E_?/, "").replace(/GameProgressState$/, "")), category: "system" };
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

