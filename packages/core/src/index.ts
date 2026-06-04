// @tt-save/core — decrypt, parse, edit, and re-encrypt LEGO Batman: Legacy of the
// Dark Knight save files. Everything is pure data (no game, no network).

export { Keystream, KEYSTREAM_ANCHOR, decrypt, encrypt, KeystreamTooShortError } from "./crypt/index.js";
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
  NotGvasError,
  BinaryReader,
  BinaryWriter,
} from "./gvas/index.js";
export type { GvasDocument, GvasHeader, CustomVersion, ScalarField, ScalarKind, EnumField } from "./gvas/index.js";
export { KNOWN_ENUMS, enumOptions, ENUM_META, enumMeta, CATEGORY_LABELS } from "./enums.js";
export type { EnumMeta, EnumCategory } from "./enums.js";
export { SaveFile, RoundTripError } from "./sav/index.js";
export { recipes, downgradeRecipe, renameRecipe, readBuildVersion } from "./recipes/index.js";
export type { Recipe, RecipeParam, ParamType } from "./recipes/index.js";
