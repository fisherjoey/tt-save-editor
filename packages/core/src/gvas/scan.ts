import { BinaryReader, BinaryWriter } from "./binary.js";
import { parseStructure, ancestorContainers } from "./structure.js";

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
    } else {
      pos++;
    }
  }
  return out;
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
