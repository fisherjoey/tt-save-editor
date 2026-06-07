import { BinaryReader, BinaryWriter } from "./binary.js";
import { parseStructure, ancestorContainers, PropertyNode } from "./structure.js";

/** Fixed-width scalar property types and their value byte length. */
const FIXED: Record<string, number> = {
  Int8Property: 1,
  Int16Property: 2,
  UInt16Property: 2,
  IntProperty: 4,
  UInt32Property: 4,
  FloatProperty: 4,
  Int64Property: 8,
  UInt64Property: 8,
  DoubleProperty: 8,
};
const STR = new Set(["StrProperty", "NameProperty"]);
const BOOL = "BoolProperty";

export type ScalarKind = "int" | "uint" | "float" | "bool" | "string";

export interface ScalarField {
  name: string;
  type: string;
  kind: ScalarKind;
  value: number | bigint | boolean | string;
  /** Absolute offset in the body where the value payload starts. */
  valueOffset: number;
  /** Value payload length in bytes. */
  valueLen: number;
  /** Absolute offset of the property's `size` int32 (for variable-length string edits). */
  sizeOffset: number;
  /** Offset where the whole property tag begins. */
  tagOffset: number;
}

function readFStringChecked(r: BinaryReader, max = 256): string | null {
  if (r.remaining < 4) return null;
  const start = r.pos;
  const len = new DataView(r.buf.buffer, r.buf.byteOffset).getInt32(r.pos, true);
  if (len < 1 || len > max) {
    r.pos = start;
    return null;
  }
  if (r.remaining < 4 + len) {
    r.pos = start;
    return null;
  }
  r.pos += 4;
  const bytes = r.bytes(len);
  if (bytes[len - 1] !== 0) {
    r.pos = start;
    return null;
  }
  for (let i = 0; i < len - 1; i++) {
    const c = bytes[i]!;
    if (c < 0x20 || c > 0x7e) {
      r.pos = start;
      return null;
    }
  }
  return new TextDecoder("latin1").decode(bytes.subarray(0, len - 1));
}

function kindOf(type: string): ScalarKind {
  if (type === BOOL) return "bool";
  if (STR.has(type)) return "string";
  if (type === "FloatProperty" || type === "DoubleProperty") return "float";
  if (type.startsWith("U")) return "uint";
  return "int";
}

/** Try to read a scalar property tag at `pos`. Returns the field + end position, or null. */
function tryScalar(body: Uint8Array, pos: number): { field: ScalarField; end: number } | null {
  const r = new BinaryReader(body);
  r.pos = pos;
  const name = readFStringChecked(r, 128);
  if (name === null) return null;
  const type = readFStringChecked(r, 64);
  if (type === null) return null;
  const isFixed = type in FIXED;
  if (!isFixed && !STR.has(type) && type !== BOOL) return null;
  if (r.remaining < 8) return null;
  const arrayIndex = r.i32();
  if (arrayIndex < 0 || arrayIndex > 64) return null;
  const sizeOffset = r.pos;
  const size = r.i32();

  const field: Partial<ScalarField> = { name, type, kind: kindOf(type), tagOffset: pos, sizeOffset };

  if (type === BOOL) {
    if (size !== 0 || r.remaining < 2) return null;
    const boolByte = r.pos;
    const b = r.u8();
    if (b > 1) return null;
    const hasGuid = r.u8();
    if (hasGuid > 1) return null;
    if (hasGuid && r.remaining < 16) return null;
    if (hasGuid) r.guid();
    return { field: { ...field, value: b === 1, valueOffset: boolByte, valueLen: 1 } as ScalarField, end: r.pos };
  }

  if (isFixed) {
    if (size !== FIXED[type]) return null;
    if (r.remaining < 1) return null;
    const hasGuid = r.u8();
    if (hasGuid > 1) return null;
    if (hasGuid && r.remaining < 16) return null;
    if (hasGuid) r.guid();
    if (r.remaining < size) return null;
    const valueOffset = r.pos;
    const value = decodeFixed(body, valueOffset, type);
    r.pos += size;
    return { field: { ...field, value, valueOffset, valueLen: size } as ScalarField, end: r.pos };
  }

  // StrProperty / NameProperty: value is an FString of exactly `size` bytes
  if (r.remaining < 1) return null;
  const hasGuid = r.u8();
  if (hasGuid > 1) return null;
  if (hasGuid && r.remaining < 16) return null;
  if (hasGuid) r.guid();
  const valueOffset = r.pos;
  if (r.remaining < size) return null;
  const inner = new BinaryReader(body.subarray(valueOffset, valueOffset + size));
  const str = readFStringChecked(inner, 1024);
  if (str === null || inner.pos !== size) return null;
  r.pos = valueOffset + size;
  return { field: { ...field, value: str, valueOffset, valueLen: size } as ScalarField, end: r.pos };
}

function decodeFixed(body: Uint8Array, off: number, type: string): number | bigint {
  const dv = new DataView(body.buffer, body.byteOffset + off);
  switch (type) {
    case "Int8Property":
      return dv.getInt8(0);
    case "Int16Property":
      return dv.getInt16(0, true);
    case "UInt16Property":
      return dv.getUint16(0, true);
    case "IntProperty":
      return dv.getInt32(0, true);
    case "UInt32Property":
      return dv.getUint32(0, true);
    case "FloatProperty":
      return dv.getFloat32(0, true);
    case "Int64Property":
      return dv.getBigInt64(0, true);
    case "UInt64Property":
      return dv.getBigUint64(0, true);
    case "DoubleProperty":
      return dv.getFloat64(0, true);
    default:
      return 0;
  }
}

/** Find every editable scalar field in the body. Strong validation makes false hits negligible. */
export function scanFields(body: Uint8Array): ScalarField[] {
  const out: ScalarField[] = [];
  let pos = 0;
  while (pos < body.length) {
    const hit = tryScalar(body, pos);
    if (hit) {
      out.push(hit.field);
      pos = hit.end;
      continue;
    }
    const ts = tryTimespanStruct(body, pos);
    if (ts) {
      out.push(ts.field);
      pos = ts.end;
      continue;
    }
    pos++;
  }
  return out;
}

/** Browser-safe byte search (no Node Buffer dependency). */
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Match a StructProperty whose AssetName is "Timespan" (= UE FTimespan, an Int64
 * count of 100ns ticks). Treat it as an editable Int64 so users can read/write
 * playtime fields. We don't fully parse the UE 5.5+ TopLevelAssetPath struct tag
 * here — we just scan for the literal token sequence and lock onto the 8-byte
 * payload at the end.
 */
function tryTimespanStruct(body: Uint8Array, pos: number): { field: ScalarField; end: number } | null {
  const r = new BinaryReader(body);
  r.pos = pos;
  const name = readFStringChecked(r, 128);
  if (name === null) return null;
  const type = readFStringChecked(r, 64);
  if (type !== "StructProperty") return null;
  // Scan forward for "Timespan\0" within a small window — confirms this is the
  // Timespan variant (vs other struct types we don't model).
  const lookahead = body.subarray(r.pos, Math.min(body.length, r.pos + 80));
  const tsNeedle = Uint8Array.of(0x54, 0x69, 0x6d, 0x65, 0x73, 0x70, 0x61, 0x6e, 0x00); // "Timespan\0"
  const tsIdx = indexOfBytes(lookahead, tsNeedle);
  if (tsIdx < 0) return null;
  // Find size = 8 followed by an extra byte (the mystery 0x08 padding/flag) then 8 value bytes.
  // The size i32 sits right before the value payload. Scan forward for `08 00 00 00 XX <8 bytes>`
  // followed by `None` or another property tag.
  const after = body.subarray(r.pos + tsIdx + 9, Math.min(body.length, r.pos + tsIdx + 9 + 80));
  const sizeNeedle = Uint8Array.of(0x08, 0x00, 0x00, 0x00);
  const sizeIdx = indexOfBytes(after, sizeNeedle);
  if (sizeIdx < 0) return null;
  const sizeOffset = r.pos + tsIdx + 9 + sizeIdx;
  // Value lives 5 bytes after the size int32 (the 0x08 padding/hasGuid byte then the Int64).
  const valueOffset = sizeOffset + 5;
  if (valueOffset + 8 > body.length) return null;
  const dv = new DataView(body.buffer, body.byteOffset + valueOffset);
  const value = dv.getBigInt64(0, true);
  return {
    field: {
      name,
      type: "Int64Property", // editable like an Int64
      kind: "int",
      value,
      valueOffset,
      valueLen: 8,
      sizeOffset,
      tagOffset: pos,
    },
    end: valueOffset + 8,
  };
}

export function findField(fields: ScalarField[], name: string): ScalarField | undefined {
  return fields.find((f) => f.name === name);
}

export interface EnumField {
  /** The enum type, e.g. "ETtSaveGameVersion". */
  enumType: string;
  /** The current member, e.g. "Initial". */
  member: string;
  /** Full stored value, e.g. "ETtSaveGameVersion::Initial". */
  value: string;
  /** The nearest preceding identifier (e.g. a gameplay-tag key) that distinguishes
   *  this instance from other entries of the same enum type. May be undefined. */
  context?: string;
  valueOffset: number;
  valueLen: number;
  sizeOffset: number;
}

interface StringHit {
  offset: number;
  value: string;
  byteLen: number;
}

/** Forward-scan every length-prefixed FString with its offset (for enum + context detection). */
function collectStrings(body: Uint8Array): StringHit[] {
  const out: StringHit[] = [];
  let pos = 0;
  while (pos < body.length) {
    const r = new BinaryReader(body);
    r.pos = pos;
    const s = readFStringChecked(r, 512);
    if (s !== null) {
      out.push({ offset: pos, value: s, byteLen: r.pos - pos });
      pos = r.pos;
    } else {
      pos++;
    }
  }
  return out;
}

/** A string that identifies a specific instance — a gameplay tag / dotted key. */
function isContextKey(s: string): boolean {
  return s.includes(".") && !s.startsWith("/") && !s.includes("::") && s !== "None";
}

/**
 * Find UE enum values: FStrings shaped like `EnumType::Member`, framed by a
 * `size int32 == fstring length` then a `hasGuid == 0` byte. The strict framing
 * is what makes editing one safe. Each gets the nearest preceding dotted key as
 * `context` so duplicate enum types can be told apart.
 */
export function scanEnums(body: Uint8Array): EnumField[] {
  const dv = new DataView(body.buffer, body.byteOffset);
  const strings = collectStrings(body);
  const out: EnumField[] = [];
  let lastKey: string | undefined;
  for (const s of strings) {
    if (isContextKey(s.value)) lastKey = s.value;
    if (!s.value.includes("::")) continue;
    if (s.offset < 5 || body[s.offset - 1] !== 0 || dv.getInt32(s.offset - 5, true) !== s.byteLen) continue;
    const [enumType, member] = splitOnce(s.value, "::");
    out.push({ enumType, member, value: s.value, ...(lastKey ? { context: lastKey } : {}), valueOffset: s.offset, valueLen: s.byteLen, sizeOffset: s.offset - 5 });
  }
  return out;
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
}

// ── Collectible array insertion (v0.1.4) ──────────────────────────────────────
//
// Displayed in-game counters (gold bricks, Wayne Tech chips, trophies, minikits,
// …) are computed from how many entries EXIST in the single, flat
// `SavedGameProgressEnumValues` ArrayProperty<StructProperty> — not from their
// states. Editing an existing entry's state never moves a counter; only adding a
// new entry does. Every collectible type lives in that one array, distinguished
// solely by its `ProgressTag` gameplay tag, so there is exactly one insertion
// mechanism for all of them.
//
// Each element is a `TtGameProgressSavedEnumValue` struct serialized as tagged
// Properties..None with two members and NO per-element size field:
//   SavedEnumNameValue  NameProperty   → e.g. "ETtCollectableGameProgressState::Consumed"
//   ProgressTag         StructProperty (/Script/GameplayTags.GameplayTag, tagged)
//       TagName         NameProperty   → e.g. "GameProgress.Definitions.GoldBricks.Story.00.04.01GB"
//       None
//   None

/** The two FString members of one array element. */
export interface EnumArrayEntry {
  /** The ProgressTag gameplay-tag string (identifies WHICH collectible). */
  tag: string;
  /** The SavedEnumNameValue, e.g. "ETtCollectableGameProgressState::Consumed". */
  state: string;
  /** Index within its array. */
  index: number;
}

/**
 * Clone an existing entry to create a new one. Per the v0.1.4 template-matching
 * rule: pick `templateTag` from the SAME collectible category as `newTag` so the
 * cloned struct already carries the right enum TYPE and (by default) state — e.g.
 * to add a gold brick, clone another gold brick. `newState` only overrides the
 * cloned member when you deliberately want a different one. This keeps every
 * future category (Wayne Tech chips, trophies, minikits, …) on one code path:
 * find a sibling entry, swap its tag.
 */
export interface EnumEntryInsertion {
  /** Tag of an existing entry to clone (choose a sibling in the same category). */
  templateTag: string;
  /** The new gameplay tag to insert. */
  newTag: string;
  /** Optional override for the cloned SavedEnumNameValue ("EnumType::Member"). */
  newState?: string;
}

/** Read an FString (i32 len + bytes incl. trailing NUL) at an absolute body offset. */
function readFStringAt(body: Uint8Array, off: number): string {
  const len = new DataView(body.buffer, body.byteOffset).getInt32(off, true);
  if (len <= 0) return "";
  return new TextDecoder("latin1").decode(body.subarray(off + 4, off + 4 + len - 1));
}

function fstringBytes(s: string): Uint8Array {
  const w = new BinaryWriter();
  w.fstring(s);
  return w.toBytes();
}

/** Every SavedGameProgressEnumValues ArrayProperty<StructProperty> with elements. */
function findEnumArrays(body: Uint8Array): PropertyNode[] {
  const out: PropertyNode[] = [];
  const stack = [...parseStructure(body)];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.name === "SavedGameProgressEnumValues" && n.children?.length) out.push(n);
    if (n.children) stack.push(...n.children);
  }
  return out;
}

interface ElementParts {
  tag: string;
  state: string;
  stateNode?: PropertyNode;
  progressTagNode?: PropertyNode;
  tagNameNode?: PropertyNode;
}

/** Resolve the SavedEnumNameValue / ProgressTag / TagName nodes of one element. */
function elementParts(body: Uint8Array, elem: PropertyNode): ElementParts {
  const stateNode = elem.children?.find((c) => c.name === "SavedEnumNameValue");
  const progressTagNode = elem.children?.find((c) => c.name === "ProgressTag");
  const tagNameNode = progressTagNode?.children?.find((c) => c.name === "TagName");
  return {
    tag: tagNameNode ? readFStringAt(body, tagNameNode.valueStart) : "",
    state: stateNode ? readFStringAt(body, stateNode.valueStart) : "",
    ...(stateNode ? { stateNode } : {}),
    ...(progressTagNode ? { progressTagNode } : {}),
    ...(tagNameNode ? { tagNameNode } : {}),
  };
}

/** List every collectible entry (tag + state) across the save's enum array(s). */
export function readEnumArrayEntries(body: Uint8Array): EnumArrayEntry[] {
  const out: EnumArrayEntry[] = [];
  for (const arr of findEnumArrays(body)) {
    arr.children!.forEach((elem, index) => {
      const { tag, state } = elementParts(body, elem);
      out.push({ tag, state, index });
    });
  }
  return out;
}

/**
 * Insert a new collectible entry by cloning an existing one and swapping its tag
 * (and optionally its state). Returns a NEW body. Splices the rebuilt element
 * before the array's end, increments the array's element-count int32, and bumps
 * every ancestor container's Size (the array's own included) by the new element's
 * byte length — the same ancestor-walk that keeps string edits valid.
 */
export function insertEnumEntry(body: Uint8Array, ins: EnumEntryInsertion): Uint8Array {
  let arr: PropertyNode | undefined;
  let template: PropertyNode | undefined;
  for (const a of findEnumArrays(body)) {
    const el = a.children!.find((e) => elementParts(body, e).tag === ins.templateTag);
    if (el) {
      arr = a;
      template = el;
      break;
    }
  }
  if (!arr || !template) {
    throw new Error(`insertEnumEntry: no existing entry with tag "${ins.templateTag}" to clone`);
  }
  const { stateNode, progressTagNode, tagNameNode } = elementParts(body, template);
  if (!stateNode || !progressTagNode || !tagNameNode) {
    throw new Error("insertEnumEntry: template element is missing SavedEnumNameValue/ProgressTag/TagName");
  }

  const newTagBytes = fstringBytes(ins.newTag);
  const newStateBytes = ins.newState ? fstringBytes(ins.newState) : null;
  const deltaTag = newTagBytes.length - (tagNameNode.valueEnd - tagNameNode.valueStart);

  // Rebuild the template's bytes with the two FStrings swapped and every affected
  // Size int32 fixed. Spans not touched are copied verbatim, so the element stays
  // byte-identical to a real one except for the strings we changed.
  const w = new BinaryWriter();
  // SavedEnumNameValue: name/type/arrayIndex …
  w.bytes(body.subarray(template.valueStart, stateNode.sizeOffset));
  if (newStateBytes) {
    w.i32(newStateBytes.length);
    w.bytes(body.subarray(stateNode.sizeOffset + 4, stateNode.valueStart)); // flags
    w.bytes(newStateBytes);
  } else {
    w.bytes(body.subarray(stateNode.sizeOffset, stateNode.valueEnd)); // size + flags + value, unchanged
  }
  // ProgressTag: name/type/typename …
  w.bytes(body.subarray(stateNode.valueEnd, progressTagNode.sizeOffset));
  w.i32(progressTagNode.size + deltaTag); // GameplayTag struct Size grows with the tag
  // flags + GameplayTag framing + TagName name/type/arrayIndex …
  w.bytes(body.subarray(progressTagNode.sizeOffset + 4, tagNameNode.sizeOffset));
  w.i32(newTagBytes.length); // TagName Size
  w.bytes(body.subarray(tagNameNode.sizeOffset + 4, tagNameNode.valueStart)); // flags
  w.bytes(newTagBytes);
  // closing "None" (GameplayTag) + "None" (element)
  w.bytes(body.subarray(tagNameNode.valueEnd, template.valueEnd));

  const newElem = w.toBytes();
  const delta = newElem.length;

  // Splice the element in just before the array's end.
  const out = new Uint8Array(body.length + delta);
  out.set(body.subarray(0, arr.valueEnd), 0);
  out.set(newElem, arr.valueEnd);
  out.set(body.subarray(arr.valueEnd), arr.valueEnd + delta);

  const dv = new DataView(out.buffer);
  // Element-count int32 at the array's value start: +1.
  dv.setInt32(arr.valueStart, dv.getInt32(arr.valueStart, true) + 1, true);
  // Bump every ancestor Size (array included). An offset just past the count is
  // strictly inside the array, so ancestorContainers returns the array too. All
  // ancestor sizeOffsets sit before the splice point, so they stay valid in `out`.
  for (const a of ancestorContainers(parseStructure(body), arr.valueStart + 4)) {
    dv.setInt32(a.sizeOffset, dv.getInt32(a.sizeOffset, true) + delta, true);
  }
  return out;
}

/** Build one new element's bytes by cloning a template and swapping its tag (+ optional state). */
function buildElementBytes(
  body: Uint8Array,
  template: PropertyNode,
  stateNode: PropertyNode,
  progressTagNode: PropertyNode,
  tagNameNode: PropertyNode,
  newTag: string,
  newStateBytes: Uint8Array | null,
): Uint8Array {
  const newTagBytes = fstringBytes(newTag);
  const deltaTag = newTagBytes.length - (tagNameNode.valueEnd - tagNameNode.valueStart);
  const w = new BinaryWriter();
  w.bytes(body.subarray(template.valueStart, stateNode.sizeOffset));
  if (newStateBytes) {
    w.i32(newStateBytes.length);
    w.bytes(body.subarray(stateNode.sizeOffset + 4, stateNode.valueStart));
    w.bytes(newStateBytes);
  } else {
    w.bytes(body.subarray(stateNode.sizeOffset, stateNode.valueEnd));
  }
  w.bytes(body.subarray(stateNode.valueEnd, progressTagNode.sizeOffset));
  w.i32(progressTagNode.size + deltaTag);
  w.bytes(body.subarray(progressTagNode.sizeOffset + 4, tagNameNode.sizeOffset));
  w.i32(newTagBytes.length);
  w.bytes(body.subarray(tagNameNode.sizeOffset + 4, tagNameNode.valueStart));
  w.bytes(newTagBytes);
  w.bytes(body.subarray(tagNameNode.valueEnd, template.valueEnd));
  return w.toBytes();
}

/**
 * Insert MANY entries in one pass — clones the first array element as a structural
 * template, builds every new element, and splices them all before the array end with
 * a single count bump + ancestor-size update. Byte-identical to inserting one at a
 * time, but parses the body once instead of once per entry. Skips tags already present.
 */
export function insertEnumEntriesBatch(body: Uint8Array, tags: string[], stateValue: string): Uint8Array {
  if (tags.length === 0) return body;
  const tree = parseStructure(body);
  let arr: PropertyNode | undefined;
  const stack = [...tree];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.name === "SavedGameProgressEnumValues" && n.children?.length) { arr = n; break; }
    if (n.children) stack.push(...n.children);
  }
  if (!arr || !arr.children?.length) throw new Error("insertEnumEntriesBatch: no SavedGameProgressEnumValues array");
  const template = arr.children[0]!;
  const present = new Set(arr.children.map((el) => elementParts(body, el).tag));
  const { stateNode, progressTagNode, tagNameNode } = elementParts(body, template);
  if (!stateNode || !progressTagNode || !tagNameNode) {
    throw new Error("insertEnumEntriesBatch: template element missing SavedEnumNameValue/ProgressTag/TagName");
  }
  const newStateBytes = fstringBytes(stateValue);

  const blobs: Uint8Array[] = [];
  let added = 0;
  for (const tag of tags) {
    if (present.has(tag)) continue;
    present.add(tag);
    blobs.push(buildElementBytes(body, template, stateNode, progressTagNode, tagNameNode, tag, newStateBytes));
    added++;
  }
  if (added === 0) return body;

  let total = 0;
  for (const b of blobs) total += b.length;
  const out = new Uint8Array(body.length + total);
  out.set(body.subarray(0, arr.valueEnd), 0);
  let o = arr.valueEnd;
  for (const b of blobs) { out.set(b, o); o += b.length; }
  out.set(body.subarray(arr.valueEnd), arr.valueEnd + total);

  const dv = new DataView(out.buffer);
  dv.setInt32(arr.valueStart, dv.getInt32(arr.valueStart, true) + added, true);
  for (const a of ancestorContainers(tree, arr.valueStart + 4)) {
    dv.setInt32(a.sizeOffset, dv.getInt32(a.sizeOffset, true) + total, true);
  }
  return out;
}

/** Distinct members observed for each enum type across the save (for dropdown options). */
export function observedEnumMembers(enums: EnumField[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of enums) {
    if (!m.has(e.enumType)) m.set(e.enumType, new Set());
    m.get(e.enumType)!.add(e.member);
  }
  return m;
}

/** Set an enum field to `EnumType::member`, splicing the FString and fixing its size. */
export function setEnumValue(body: Uint8Array, field: EnumField, member: string): Uint8Array {
  const newValue = `${field.enumType}::${member}`;
  return setStringValue(body, { kind: "string", valueOffset: field.valueOffset, valueLen: field.valueLen, sizeOffset: field.sizeOffset } as ScalarField, newValue);
}

/** Write a new numeric/bool value into a fixed-width or bool field (in place, same length). */
export function setFixedValue(body: Uint8Array, field: ScalarField, value: number | bigint | boolean): Uint8Array {
  const out = body.slice();
  const dv = new DataView(out.buffer, out.byteOffset + field.valueOffset);
  switch (field.type) {
    case "BoolProperty":
      out[field.valueOffset] = value ? 1 : 0;
      break;
    case "Int8Property":
      dv.setInt8(0, Number(value));
      break;
    case "Int16Property":
      dv.setInt16(0, Number(value), true);
      break;
    case "UInt16Property":
      dv.setUint16(0, Number(value), true);
      break;
    case "IntProperty":
      dv.setInt32(0, Number(value), true);
      break;
    case "UInt32Property":
      dv.setUint32(0, Number(value) >>> 0, true);
      break;
    case "FloatProperty":
      dv.setFloat32(0, Number(value), true);
      break;
    case "Int64Property":
      dv.setBigInt64(0, BigInt(value as number | bigint), true);
      break;
    case "UInt64Property":
      dv.setBigUint64(0, BigInt(value as number | bigint), true);
      break;
    case "DoubleProperty":
      dv.setFloat64(0, Number(value), true);
      break;
    default:
      throw new Error(`setFixedValue: ${field.type} is not a fixed-width field`);
  }
  return out;
}

/**
 * Write a new string into a Str/NameProperty/EnumProperty FString, splicing and
 * fixing the size int32. If the new payload changes length, also walks every
 * ancestor container (Struct/Array/Map/InstancedStruct) and bumps its outer Size
 * by the delta — without that, neighbouring entries inside the same container
 * get misread by the game (the v0.1.1 "edit X resets Y" bug).
 */
export function setStringValue(body: Uint8Array, field: ScalarField, value: string): Uint8Array {
  if (field.kind !== "string") throw new Error("setStringValue on non-string field");
  const w = new BinaryWriter();
  w.fstring(value);
  const newPayload = w.toBytes();
  const delta = newPayload.length - field.valueLen;

  // Resolve ancestor containers from the OLD body, before splicing. Their sizeOffsets
  // all sit before the edit point, so they remain valid in the new body.
  const ancestors = delta === 0 ? [] : ancestorContainers(parseStructure(body), field.valueOffset);

  const out = new Uint8Array(body.length - field.valueLen + newPayload.length);
  out.set(body.subarray(0, field.valueOffset), 0);
  out.set(newPayload, field.valueOffset);
  out.set(body.subarray(field.valueOffset + field.valueLen), field.valueOffset + newPayload.length);

  const dv = new DataView(out.buffer);
  dv.setInt32(field.sizeOffset, newPayload.length, true);
  for (const a of ancestors) {
    dv.setInt32(a.sizeOffset, dv.getInt32(a.sizeOffset, true) + delta, true);
  }
  return out;
}
