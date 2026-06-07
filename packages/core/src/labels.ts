import { prettifyKey } from "./enums.js";
import { PROGRESS_NAMES } from "./data/progress-names.generated.js";

/** Gotham island/region codes that appear inside raw progress paths. */
const ISLANDS: Record<string, string> = {
  CI: "Central Island",
  NI: "North Island",
  SI: "South Island",
  TC: "Tricorner",
};

/**
 * A human-readable name for any mission/objective/activity progress tag.
 *
 * Prefers the curated name from PROGRESS_NAMES; otherwise builds a clean label
 * instead of dumping the raw internal path. A player never sees
 * "Activities › Instances › CI › GVRP › Croc › 00 › OBJ01" — they see "Objective 1".
 */
export function friendlyProgressName(tag: string): string {
  const named = PROGRESS_NAMES[tag];
  if (named) return named;

  let t = tag.replace(/^GameProgress\.Definitions\./, "");
  const isBadge = /\.CompletionBadge$/.test(t);
  if (isBadge) t = t.replace(/\.CompletionBadge$/, "");
  const badgeNote = isBadge ? " (100% marker)" : "";

  // Objective: trailing OBJnn, optionally a single-letter sub-step and a numeric sub-sub-step.
  const obj = t.match(/\.OBJ(\d+)(?:\.([A-Z])(?:\.(\d+))?)?$/);
  if (obj) {
    const sub = obj[2] ? ` (part ${obj[2]}${obj[3] ? `-${parseInt(obj[3], 10)}` : ""})` : "";
    return `Objective ${parseInt(obj[1]!, 10)}${sub}${badgeNote}`;
  }

  // Game-wide overall completion bucket.
  if (/Gamewide\.100Percent/.test(t)) return `Overall 100% completion${badgeNote}`;

  // Story mission index: Story.CC.MM with an optional variant letter.
  const story = t.match(/(?:^|\.)Story\.(\d+)\.(\d+)([A-Z]?)(?:$|\.)/);
  if (story) {
    const part = story[3] ? ` (part ${story[3]})` : "";
    return `Story mission ${parseInt(story[1]!, 10)}-${parseInt(story[2]!, 10)}${part}${badgeNote}`;
  }

  // Generic fallback: decode island codes, then space the path out.
  const decoded = t
    .split(".")
    .map((s) => ISLANDS[s] ?? s)
    .join(".");
  return prettifyKey(decoded) + badgeNote;
}
