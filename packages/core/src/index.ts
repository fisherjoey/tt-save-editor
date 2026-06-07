// @tt-save/core — decrypt, parse, edit, and re-encrypt LEGO Batman: Legacy of the
// Dark Knight save files. Everything is pure data (no game, no network).

export { decrypt, encrypt } from "./crypt/index.js";
export {
  parse,
  serialize,
  scanFields,
  findField,
  setFixedValue,
  setStringValue,
  scanEnums,
  observedEnumMembers,
  setEnumValue,
  readEnumArrayEntries,
  insertEnumEntry,
  NotGvasError,
  BinaryReader,
  BinaryWriter,
} from "./gvas/index.js";
export type { GvasDocument, GvasHeader, CustomVersion, ScalarField, ScalarKind, EnumField, EnumArrayEntry, EnumEntryInsertion } from "./gvas/index.js";
export { COLLECTIBLES, normalizeConfidence, prettifyTagPath, deriveFacets, selectCounterTags } from "./collectibles.js";
export type { CollectibleCounter, CollectibleTag, CollectibleFacets, Confidence } from "./collectibles.js";
export {
  PROGRESS_MISSION_TAGS,
  PROGRESS_OBJECTIVE_TAGS,
  MISSION_COMPLETE_STATE,
  OBJECTIVE_COMPLETE_STATE,
} from "./data/progress.generated.js";
export { PROGRESS_NAMES } from "./data/progress-names.generated.js";
export { summarizeChanges, hasChanges } from "./diff.js";
export type { SaveChanges, AddedEntry, StateChange, ScalarChange } from "./diff.js";
export { KNOWN_ENUMS, enumOptions, ENUM_META, enumMeta, enumMemberLabel, CATEGORY_LABELS, prettifyKey } from "./enums.js";
export type { EnumMeta, EnumCategory } from "./enums.js";
export { friendlyProgressName } from "./labels.js";
export { FEATURED_FIELDS, toDisplay, fromDisplay } from "./featured.js";
export type { FeaturedField } from "./featured.js";
export { SaveFile, RoundTripError } from "./sav/index.js";
export { recipes, downgradeRecipe, renameRecipe, readBuildVersion } from "./recipes/index.js";
export type { Recipe, RecipeParam, ParamType } from "./recipes/index.js";
