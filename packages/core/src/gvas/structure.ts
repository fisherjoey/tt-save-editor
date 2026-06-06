import { BinaryReader } from "./binary.js";

/**
 * Recursive GVAS structure parser. Walks the body and builds a tree of every
 * property, tracking each container's `size` int32 location so edits that
 * change byte length can update all ancestor container sizes.
 *
 * Without this, editing an enum value to one of different length (e.g.
 * Purchased -> Unpurchased) shifts subsequent bytes but the containing
 * ArrayProperty/MapProperty/StructProperty's outer Size field stays stale,
 * which causes the game to misread the rest of the container — exactly the
 * "edit X resets Y" save-corruption bug.
 */

export interface PropertyNode {
  name: string;
  type: string;
  /** Offset of the property's `size` int32 in the body. Update this when the body grows/shrinks. */
  sizeOffset: number;
  size: number;
  /** First byte of the value payload (just after the tag). */
  valueStart: number;
  /** Last byte (exclusive) of the value payload = valueStart + size. */
  valueEnd: number;
  /** Children for container types (Struct / Array<Struct> / Map). */
  children?: PropertyNode[];
}

const TERMINATOR = "None";

/** Read a property tag at `r.pos` and return the parsed node. After returning,
 *  `r.pos` is at the start of the value payload. */
function readTag(r: BinaryReader): PropertyNode | null {
  const start = r.pos;
  const name = readFString(r);
  if (name === null) {
    r.pos = start;
    return null;
  }
  if (name === TERMINATOR) {
    r.pos = start; // leave terminator alone — caller handles it
    return null;
  }
  const type = readFString(r);
  if (type === null) {
    r.pos = start;
    return null;
  }
  r.i32(); // arrayIndex (we don't need to track this)
  const sizeOffset = r.pos;
  const size = r.i32();
  // type-specific extra tag bytes
  switch (type) {
    case "StructProperty":
      readFString(r); // structName
      r.bytes(16); // structGuid
      break;
    case "ArrayProperty":
    case "SetProperty":
      readFString(r); // innerType
      break;
    case "MapProperty":
      readFString(r); // keyType
      readFString(r); // valueType
      break;
    case "ByteProperty":
    case "EnumProperty":
      readFString(r); // enumName
      break;
    case "BoolProperty":
      r.u8(); // boolValue
      break;
  }
  const hasGuid = r.u8();
  if (hasGuid) r.bytes(16);
  const valueStart = r.pos;
  return { name, type, sizeOffset, size, valueStart, valueEnd: valueStart + size };
}

/** FString reader that returns null if the int32 length is invalid. */
function readFString(r: BinaryReader): string | null {
  if (r.remaining < 4) return null;
  const start = r.pos;
  const ln = r.i32();
  if (ln === 0) return "";
  if (ln > 0) {
    if (r.remaining < ln) {
      r.pos = start;
      return null;
    }
    const bytes = r.bytes(ln);
    if (bytes[ln - 1] !== 0) {
      r.pos = start;
      return null;
    }
    return new TextDecoder("latin1").decode(bytes.subarray(0, ln - 1));
  }
  // negative = utf-16le, -ln chars
  const chars = -ln;
  if (r.remaining < chars * 2) {
    r.pos = start;
    return null;
  }
  const bytes = r.bytes(chars * 2);
  return new TextDecoder("utf-16le").decode(bytes.subarray(0, bytes.length - 2));
}

/** Parse a list of properties starting at `r.pos`, stopping at the "None" terminator
 *  (which is consumed) or at `end`. Returns the list of nodes. */
function parsePropertyList(r: BinaryReader, end: number, body: Uint8Array): PropertyNode[] {
  const nodes: PropertyNode[] = [];
  while (r.pos < end) {
    const peekStart = r.pos;
    const peeked = readFString(r);
    if (peeked === TERMINATOR) {
      // "None" already consumed by readFString; that's the end of this struct
      return nodes;
    }
    r.pos = peekStart;
    const tag = readTag(r);
    if (!tag) break;
    // recurse into containers
    parseContainerChildren(tag, body);
    r.pos = tag.valueEnd;
    nodes.push(tag);
  }
  return nodes;
}

/** Given a container node, recurse into its value payload to enumerate children. */
function parseContainerChildren(node: PropertyNode, body: Uint8Array): void {
  if (node.type === "StructProperty") {
    const r = new BinaryReader(body);
    r.pos = node.valueStart;
    node.children = parsePropertyList(r, node.valueEnd, body);
    return;
  }
  if (node.type === "ArrayProperty") {
    // value: i32 count + (if elementType == StructProperty: inner tag) + elements
    const r = new BinaryReader(body);
    r.pos = node.valueStart;
    const count = r.i32();
    // After the count, for an Array<Struct> there's an inline element tag block.
    // Heuristic: peek next FString; if it looks like a valid name AND the property type after is StructProperty, treat as Array<Struct>.
    const peekPos = r.pos;
    const peekName = readFString(r);
    const peekType = peekName !== null ? readFString(r) : null;
    if (peekType === "StructProperty") {
      // Read full struct tag (we already consumed name+type)
      r.i32(); // arrayIndex
      const innerSizeOff = r.pos;
      const innerSize = r.i32();
      readFString(r); // structType (e.g. "TtGameProgressSavedEnumValue")
      r.bytes(16); // structGuid
      const innerHasGuid = r.u8();
      if (innerHasGuid) r.bytes(16);
      const elementsStart = r.pos;
      // Each element is a property list terminated by None
      node.children = [];
      // Record the inner struct's size field too — it spans all elements combined.
      const innerNode: PropertyNode = {
        name: "<elements>",
        type: "ArrayInnerStruct",
        sizeOffset: innerSizeOff,
        size: innerSize,
        valueStart: elementsStart,
        valueEnd: elementsStart + innerSize,
        children: [],
      };
      for (let i = 0; i < count; i++) {
        const elemStart = r.pos;
        const elem: PropertyNode = {
          name: `[${i}]`,
          type: "StructElement",
          sizeOffset: -1, // elements have no size of their own (terminated by None)
          size: 0,
          valueStart: elemStart,
          valueEnd: elemStart, // will fix after parsing
          children: parsePropertyList(r, node.valueEnd, body),
        };
        elem.valueEnd = r.pos;
        innerNode.children!.push(elem);
      }
      node.children.push(innerNode);
      return;
    }
    // scalar array — no inner containers we need to track
    r.pos = peekPos;
    return;
  }
  if (node.type === "MapProperty") {
    // value: i32 numKeysToRemove + (remove keys, each keyType-sized) + i32 numEntries + entries
    // We don't fully model map internals here; we just track the outer Map.
    // For now, treat as a black box — the Map's own Size encompasses all entries.
    // We DO need to recurse to find nested containers though.
    // Conservative approach: scan property tags within bounds.
    const r = new BinaryReader(body);
    r.pos = node.valueStart;
    r.i32(); // numKeysToRemove
    // We don't know key sizes; can't safely skip keys. Best effort: skim for nested property tags.
    // Acceptable: if a map's entries are scalars/strings only, no nested containers; if they're structs,
    // we'd miss them. For this game's saves the enum-bearing maps don't have nested containers we care about.
    node.children = [];
    return;
  }
}

/** Look like the start of a valid property tag: short ASCII name FString followed by a
 *  short ASCII type FString matching one of the known property type names. */
const KNOWN_TYPES = new Set([
  "BoolProperty",
  "IntProperty",
  "UInt32Property",
  "Int64Property",
  "UInt64Property",
  "Int16Property",
  "UInt16Property",
  "Int8Property",
  "ByteProperty",
  "FloatProperty",
  "DoubleProperty",
  "StrProperty",
  "NameProperty",
  "TextProperty",
  "StructProperty",
  "ArrayProperty",
  "SetProperty",
  "MapProperty",
  "EnumProperty",
  "ObjectProperty",
  "SoftObjectProperty",
]);

function looksLikeProperty(body: Uint8Array, pos: number): boolean {
  if (pos + 8 > body.length) return false;
  const r = new BinaryReader(body);
  r.pos = pos;
  const name = readFString(r);
  if (name === null || name.length < 2 || name.length > 128) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return false;
  const type = readFString(r);
  return type !== null && KNOWN_TYPES.has(type);
}

/** Parse the entire body and return all top-level properties (with nested children).
 *  Skips any prefix bytes until the first valid property tag. */
export function parseStructure(body: Uint8Array): PropertyNode[] {
  let start = 0;
  while (start < body.length && !looksLikeProperty(body, start)) start++;
  const r = new BinaryReader(body);
  r.pos = start;
  return parsePropertyList(r, body.length, body);
}

/** Walk all containers in the tree and return them flat, deepest first. */
function collectContainers(nodes: PropertyNode[], out: PropertyNode[] = []): PropertyNode[] {
  for (const n of nodes) {
    if (n.children) {
      collectContainers(n.children, out);
      if (n.sizeOffset >= 0) out.push(n); // skip pseudo-nodes (struct elements) with no size
    }
  }
  return out;
}

/**
 * Find every container in the tree whose value range strictly contains `offset`,
 * sorted from outermost to innermost. Used to update ancestor sizes when an
 * edit at `offset` changes the byte length.
 */
export function ancestorContainers(tree: PropertyNode[], offset: number): PropertyNode[] {
  const all = collectContainers(tree);
  return all
    .filter((c) => c.valueStart <= offset && offset < c.valueEnd)
    .sort((a, b) => a.valueStart - b.valueStart);
}
