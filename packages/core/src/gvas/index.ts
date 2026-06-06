import { BinaryReader, BinaryWriter } from "./binary.js";
import { GvasHeader, readHeader, writeHeader } from "./header.js";

export type { GvasHeader, CustomVersion } from "./header.js";
export { NotGvasError } from "./header.js";
export { BinaryReader, BinaryWriter } from "./binary.js";
export { scanFields, findField, setFixedValue, setStringValue, scanEnums, observedEnumMembers, setEnumValue, readEnumArrayEntries, insertEnumEntry } from "./scan.js";
export type { ScalarField, ScalarKind, EnumField, EnumArrayEntry, EnumEntryInsertion } from "./scan.js";
export { parseStructure, ancestorContainers } from "./structure.js";
export type { PropertyNode } from "./structure.js";

/**
 * A decrypted save = a fully-parsed header + an opaque body.
 *
 * The body uses UE5.5's modern tagged-property format whose nested structs are
 * notoriously hard to round-trip. Rather than risk corrupting saves, we keep the
 * body as RAW bytes (guaranteeing a byte-identical round-trip) and locate/edit
 * individual scalar fields inside it by name (see scan.ts). Header fields (engine
 * version, changelist, class name) are fully structured and editable.
 */
export interface GvasDocument {
  header: GvasHeader;
  /** Everything after the header, kept verbatim. Edits are applied as byte splices. */
  body: Uint8Array;
}

export function parse(plain: Uint8Array): GvasDocument {
  const r = new BinaryReader(plain);
  const header = readHeader(r);
  const body = plain.subarray(r.pos).slice();
  return { header, body };
}

export function serialize(doc: GvasDocument): Uint8Array {
  const w = new BinaryWriter();
  writeHeader(w, doc.header);
  w.bytes(doc.body);
  return w.toBytes();
}
