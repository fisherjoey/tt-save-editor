import { BinaryReader } from "./binary.js";

/**
 * UE 5.4+ GVAS structure parser.
 *
 * Walks the body and builds a tree of containers tracking each container's
 * `Size` int32 location. Edits that change byte length use ancestorContainers()
 * to find every container whose Size must be bumped to keep the save valid.
 *
 * The on-disk property tag layout (since UE 5.4, version constant
 * PROPERTY_TAG_COMPLETE_TYPE_NAME) is:
 *
 *   Name           FString
 *   TypeName       FPropertyTypeName tree (depth-first { FString Name, int32 InnerCount })
 *   Size           int32     ← the field bump-on-edit lives at
 *   Flags          uint8     EPropertyTagFlags bitfield
 *   [if 0x01]      ArrayIndex int32
 *   [if 0x02]      PropertyGuid 16 bytes
 *   [if 0x04]      uint8 ExtFlags (+ optional OverridableInformation payload)
 *   Value          Size bytes (Properties..None block OR raw native bytes)
 *
 * Container-type quirks:
 *   - Array<Struct> / Set<Struct>: body is `int32 count + N elements`, no inline
 *     element tag (the inner struct's type lives in the outer tag's TypeName).
 *     Each element is either Properties..None or raw native bytes, gated by the
 *     OUTER tag's HasBinaryOrNativeSerialize flag.
 *   - Map<K,V>: opaque to us (no inner enum edits in this game).
 *   - StructProperty: tagged Properties..None unless flag 0x08 is set (raw native).
 *   - /Script/CoreUObject.InstancedStruct: special value layout
 *     `FString struct_path + uint32 size + Properties..None`. The sub-size is its
 *     own container to update.
 *   - /Script/GameplayTags.GameplayTag: forced tagged even when flag 0x08 is set
 *     (per trumank/uesave issue #95).
 *   - /Script/TtSaveSystem.TtSaveGame trailing records: after the root's "None",
 *     N additional Properties..None blocks framed as `int32(0) + uint8(0) + ...`,
 *     one per element of the root's SaveData array. The framing prefix is NOT a
 *     Size field and is not tracked as a container.
 */

const FLAG_HAS_ARRAY_INDEX = 0x01;
const FLAG_HAS_PROPERTY_GUID = 0x02;
const FLAG_HAS_PROPERTY_EXTENSIONS = 0x04;
const FLAG_HAS_BINARY_OR_NATIVE_SERIALIZE = 0x08;
// 0x10 BoolTrue, 0x20 SkippedSerialize — unused by our walker

const INSTANCED_STRUCT = "/Script/CoreUObject.InstancedStruct";
const GAMEPLAY_TAG = "/Script/GameplayTags.GameplayTag";

const TERMINATOR = "None";

interface TypeNameNode {
  name: string;
  children: TypeNameNode[];
}

export interface PropertyNode {
  name: string;
  /** Root TypeName, e.g. "StructProperty", "ArrayProperty". */
  type: string;
  /** For Array/Set/Map, the inner type name(s). For Struct, the struct's TopLevelAssetPath. */
  innerType?: string;
  structPath?: string;
  /** Offset of this property's Size int32 in the body. -1 for pseudo-nodes without one
   *  (StructElement inside Array<Struct>, which is terminated by "None"). */
  sizeOffset: number;
  size: number;
  /** First byte of the value payload. */
  valueStart: number;
  /** Last byte (exclusive) = valueStart + size. */
  valueEnd: number;
  children?: PropertyNode[];
}

function readFStringSafe(r: BinaryReader): string | null {
  if (r.remaining < 4) return null;
  const start = r.pos;
  const len = r.i32();
  if (len === 0) return "";
  if (len > 0) {
    if (r.remaining < len || len > 8192) {
      r.pos = start;
      return null;
    }
    const bytes = r.bytes(len);
    if (bytes[len - 1] !== 0) {
      r.pos = start;
      return null;
    }
    return new TextDecoder("latin1").decode(bytes.subarray(0, len - 1));
  }
  const chars = -len;
  if (r.remaining < chars * 2 || chars > 4096) {
    r.pos = start;
    return null;
  }
  const bytes = r.bytes(chars * 2);
  return new TextDecoder("utf-16le").decode(bytes.subarray(0, bytes.length - 2));
}

/** Read a TypeName tree depth-first. Throws on malformed input. */
function readTypeName(r: BinaryReader): TypeNameNode {
  function readNode(): TypeNameNode {
    const name = readFStringSafe(r);
    if (name === null) throw new Error(`Bad FString in TypeName at body offset ${r.pos}`);
    const count = r.u32();
    if (count > 64) throw new Error(`Suspiciously large InnerCount ${count} at body offset ${r.pos - 4}`);
    const children: TypeNameNode[] = [];
    for (let i = 0; i < count; i++) children.push(readNode());
    return { name, children };
  }
  return readNode();
}

/** Build "/Package.Asset" from a TopLevelAssetPath subtree (AssetName node whose
 *  single child is the PackageName node). */
function topLevelAssetPath(node: TypeNameNode): string {
  const assetName = node.name;
  const packageName = node.children[0]?.name;
  return packageName ? `${packageName}.${assetName}` : assetName;
}

interface TagResult {
  node: PropertyNode;
  flags: number;
}

/** Read a property tag at r.pos. Returns null on "None" terminator. */
function readTag(r: BinaryReader): TagResult | null {
  const start = r.pos;
  const name = readFStringSafe(r);
  if (name === null) {
    r.pos = start;
    return null;
  }
  if (name === TERMINATOR) return null;

  const typeName = readTypeName(r);
  const sizeOffset = r.pos;
  const size = r.i32();
  const flags = r.u8();
  if (flags & FLAG_HAS_ARRAY_INDEX) r.i32();
  if (flags & FLAG_HAS_PROPERTY_GUID) r.bytes(16);
  if (flags & FLAG_HAS_PROPERTY_EXTENSIONS) {
    const ef = r.u8();
    if (ef & 0x02) {
      r.u8(); // OverriddenPropertyOperation
      r.u8(); // bExperimentalOverridableLogic
    }
  }
  const valueStart = r.pos;
  const valueEnd = valueStart + size;
  const type = typeName.name;

  let structPath: string | undefined;
  let innerType: string | undefined;

  if (type === "StructProperty" && typeName.children.length > 0) {
    structPath = topLevelAssetPath(typeName.children[0]!);
  } else if ((type === "ArrayProperty" || type === "SetProperty") && typeName.children.length > 0) {
    const inner = typeName.children[0]!;
    innerType = inner.name;
    if (innerType === "StructProperty" && inner.children.length > 0) {
      structPath = topLevelAssetPath(inner.children[0]!);
    }
  } else if (type === "MapProperty" && typeName.children.length >= 2) {
    innerType = `${typeName.children[0]!.name},${typeName.children[1]!.name}`;
  }

  const node: PropertyNode = {
    name,
    type,
    sizeOffset,
    size,
    valueStart,
    valueEnd,
    ...(innerType ? { innerType } : {}),
    ...(structPath ? { structPath } : {}),
  };
  return { node, flags };
}

/** Tagged-properties (true) vs raw native bytes (false). */
function isTaggedStruct(structPath: string | undefined, flags: number): boolean {
  if (structPath === GAMEPLAY_TAG) return true;
  if (flags & FLAG_HAS_BINARY_OR_NATIVE_SERIALIZE) return false;
  return true;
}

/** Recurse into a container value to enumerate nested containers/properties. */
function recurseIntoContainer(node: PropertyNode, flags: number, body: Uint8Array): void {
  if (node.type === "StructProperty") {
    if (node.structPath === INSTANCED_STRUCT) {
      // FString struct_path + uint32 size + (if non-empty) Properties..None
      const r = new BinaryReader(body);
      r.pos = node.valueStart;
      readFStringSafe(r);
      const innerSizeOff = r.pos;
      const innerSize = r.u32();
      const innerStart = r.pos;
      const innerEnd = innerStart + innerSize;
      const innerNode: PropertyNode = {
        name: "<instanced>",
        type: "InstancedStructInner",
        sizeOffset: innerSizeOff,
        size: innerSize,
        valueStart: innerStart,
        valueEnd: innerEnd,
      };
      if (innerSize > 0) {
        innerNode.children = parsePropertyList(r, innerEnd, body);
      }
      node.children = [innerNode];
      return;
    }
    if (!isTaggedStruct(node.structPath, flags)) return; // raw native; opaque
    const r = new BinaryReader(body);
    r.pos = node.valueStart;
    node.children = parsePropertyList(r, node.valueEnd, body);
    return;
  }
  if (node.type === "ArrayProperty") {
    const r = new BinaryReader(body);
    r.pos = node.valueStart;
    const count = r.i32();
    if (node.innerType !== "StructProperty" || !isTaggedStruct(node.structPath, flags)) return;
    node.children = [];
    for (let i = 0; i < count; i++) {
      const elemStart = r.pos;
      const elemChildren = parsePropertyList(r, node.valueEnd, body);
      const elemEnd = r.pos;
      node.children.push({
        name: `[${i}]`,
        type: "StructElement",
        sizeOffset: -1, // no per-element size — "None"-terminated
        size: elemEnd - elemStart,
        valueStart: elemStart,
        valueEnd: elemEnd,
        children: elemChildren,
      });
    }
    return;
  }
  // MapProperty + everything else: opaque
}

/** Read tags until "None" terminator (consumed) or end. */
function parsePropertyList(r: BinaryReader, end: number, body: Uint8Array): PropertyNode[] {
  const nodes: PropertyNode[] = [];
  while (r.pos < end) {
    const tag = readTag(r);
    if (!tag) return nodes;
    recurseIntoContainer(tag.node, tag.flags, body);
    r.pos = tag.node.valueEnd;
    nodes.push(tag.node);
  }
  return nodes;
}

const KNOWN_TYPES = new Set([
  "BoolProperty", "IntProperty", "UInt32Property", "Int64Property", "UInt64Property",
  "Int16Property", "UInt16Property", "Int8Property", "ByteProperty", "FloatProperty",
  "DoubleProperty", "StrProperty", "NameProperty", "TextProperty", "StructProperty",
  "ArrayProperty", "SetProperty", "MapProperty", "EnumProperty", "ObjectProperty",
  "SoftObjectProperty",
]);

/** A property tag whose root TypeName is a known type — used to lock on past any
 *  leading body bytes (UE5 saves have at least one prefix byte before the first tag). */
function looksLikeFirstTag(body: Uint8Array, pos: number): boolean {
  if (pos + 8 > body.length) return false;
  const r = new BinaryReader(body);
  r.pos = pos;
  try {
    const name = readFStringSafe(r);
    if (name === null || name.length < 2 || name.length > 128) return false;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return false;
    const root = readFStringSafe(r);
    return root !== null && KNOWN_TYPES.has(root);
  } catch {
    return false;
  }
}

/**
 * Parse the entire body. Returns the flat list of top-level properties (from the
 * root Properties..None block) plus the contents of any TtSaveGame trailing
 * records (each framed `int32(0) + uint8(0) + Properties..None`). The framing
 * bytes themselves are not modelled as containers (they're not Size fields).
 */
export function parseStructure(body: Uint8Array): PropertyNode[] {
  let start = 0;
  while (start < Math.min(body.length, 32) && !looksLikeFirstTag(body, start)) start++;
  const r = new BinaryReader(body);
  r.pos = start;
  const out = parsePropertyList(r, body.length, body);
  while (r.pos + 5 <= body.length) {
    const checkpoint = r.pos;
    try {
      const prefix = r.i32();
      if (prefix !== 0) {
        r.pos = checkpoint;
        break;
      }
      const sub = r.u8();
      if (sub !== 0) {
        r.pos = checkpoint;
        break;
      }
      const records = parsePropertyList(r, body.length, body);
      // Empty records are valid (a SaveData slot with no progress). Keep going as
      // long as the framing matches; only a non-zero prefix breaks the loop.
      out.push(...records);
    } catch {
      r.pos = checkpoint;
      break;
    }
  }
  return out;
}

function collectAllNodes(nodes: PropertyNode[], out: PropertyNode[] = []): PropertyNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children) collectAllNodes(n.children, out);
  }
  return out;
}

/**
 * Containers whose value range strictly contains `offset`, outermost-first.
 * "Strictly" on the left edge excludes the property whose value STARTS at
 * `offset` (its own Size is updated separately by the caller).
 */
export function ancestorContainers(tree: PropertyNode[], offset: number): PropertyNode[] {
  return collectAllNodes(tree)
    .filter((n) => n.sizeOffset >= 0 && n.valueStart < offset && offset < n.valueEnd)
    .sort((a, b) => a.valueStart - b.valueStart);
}
