import { SaveFile } from "../sav/index.js";

export type ParamType = "number" | "string" | "boolean";

export interface RecipeParam {
  name: string;
  type: ParamType;
  label: string;
  help?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  params: RecipeParam[];
  apply(save: SaveFile, params: Record<string, unknown>): void;
}

/** Name of the build-version field the game checks ("PatchVersionTooRecent"). */
const BUILD_VERSION_FIELD = "BuildVersion";

/** Read the build version this save was made on (the value the game compares). */
export function readBuildVersion(save: SaveFile): number | undefined {
  const f = save.getField(BUILD_VERSION_FIELD);
  return typeof f?.value === "number" ? f.value : undefined;
}

/**
 * Make a save load on an OLDER build: set its BuildVersion (and the engine
 * changelist stamp) to the target build's value, so it is no longer "too recent".
 * `targetBuildVersion` is the build number of the version you want to load it on
 * (i.e. the value a save made on that build carries — read one with readBuildVersion).
 */
export const downgradeRecipe: Recipe = {
  id: "downgrade",
  title: "Make save load on an older patch",
  description:
    "Lowers the save's build-version stamp so an older (pre-patch) build will load it. " +
    "Use the build number of the version you want to play it on.",
  params: [
    {
      name: "targetBuildVersion",
      type: "number",
      label: "Target build version",
      help: "The build number of the older version. Load any save made on that build and read its BuildVersion to find it.",
    },
  ],
  apply(save, params) {
    const target = Number(params.targetBuildVersion);
    if (!Number.isInteger(target)) throw new Error("targetBuildVersion must be an integer");
    save.setField(BUILD_VERSION_FIELD, target);
    // Keep the GVAS engine changelist stamp consistent with the target.
    save.doc.header.changelist = target;
  },
};

/** Rename the save slot (the label shown in-game). */
export const renameRecipe: Recipe = {
  id: "rename",
  title: "Rename save",
  description: "Change the save's display name.",
  params: [{ name: "name", type: "string", label: "New name" }],
  apply(save, params) {
    save.setField("SaveName", String(params.name));
  },
};

export const recipes: Recipe[] = [downgradeRecipe, renameRecipe];
