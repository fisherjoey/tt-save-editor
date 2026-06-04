import { BinaryReader, BinaryWriter } from "./binary.js";

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

/** Write a new string into a Str/NameProperty, splicing and fixing the size int32. */
export function setStringValue(body: Uint8Array, field: ScalarField, value: string): Uint8Array {
  if (field.kind !== "string") throw new Error("setStringValue on non-string field");
  const w = new BinaryWriter();
  w.fstring(value);
  const newPayload = w.toBytes();
  const out = new Uint8Array(body.length - field.valueLen + newPayload.length);
  out.set(body.subarray(0, field.valueOffset), 0);
  out.set(newPayload, field.valueOffset);
  out.set(body.subarray(field.valueOffset + field.valueLen), field.valueOffset + newPayload.length);
  // update the property's size int32 to the new payload length
  new DataView(out.buffer).setInt32(field.sizeOffset, newPayload.length, true);
  return out;
}
