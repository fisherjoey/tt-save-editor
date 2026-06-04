import { BinaryReader, BinaryWriter } from "./binary.js";

export interface CustomVersion {
  guid: Uint8Array; // 16 bytes
  version: number;
}

/** The FSaveGameHeader that precedes the property body of a UE5 GVAS save. */
export interface GvasHeader {
  saveGameFileVersion: number; // expect 3
  fileVersionUE4: number;
  fileVersionUE5: number;
  engineMajor: number;
  engineMinor: number;
  enginePatch: number;
  changelist: number; // engine changelist (one of the version stamps)
  branch: string; // "++Dinner+mainline"
  customVersionFormat: number;
  customVersions: CustomVersion[];
  saveGameClassName: string; // "/Script/TtSaveSystem.TtSaveGame"
}

const MAGIC = Uint8Array.of(0x47, 0x56, 0x41, 0x53); // "GVAS"

export class NotGvasError extends Error {
  constructor() {
    super("Not a GVAS save (missing GVAS magic). Did you decrypt with the right keystream?");
    this.name = "NotGvasError";
  }
}

export function readHeader(r: BinaryReader): GvasHeader {
  const magic = r.bytes(4);
  if (!MAGIC.every((b, i) => magic[i] === b)) throw new NotGvasError();
  const saveGameFileVersion = r.i32();
  const fileVersionUE4 = r.i32();
  const fileVersionUE5 = r.i32();
  const engineMajor = r.u16();
  const engineMinor = r.u16();
  const enginePatch = r.u16();
  const changelist = r.u32();
  const branch = r.fstring();
  const customVersionFormat = r.i32();
  const count = r.i32();
  const customVersions: CustomVersion[] = [];
  for (let i = 0; i < count; i++) {
    customVersions.push({ guid: r.guid(), version: r.i32() });
  }
  const saveGameClassName = r.fstring();
  return {
    saveGameFileVersion,
    fileVersionUE4,
    fileVersionUE5,
    engineMajor,
    engineMinor,
    enginePatch,
    changelist,
    branch,
    customVersionFormat,
    customVersions,
    saveGameClassName,
  };
}

export function writeHeader(w: BinaryWriter, h: GvasHeader): void {
  w.bytes(MAGIC);
  w.i32(h.saveGameFileVersion);
  w.i32(h.fileVersionUE4);
  w.i32(h.fileVersionUE5);
  w.u16(h.engineMajor);
  w.u16(h.engineMinor);
  w.u16(h.enginePatch);
  w.u32(h.changelist);
  w.fstring(h.branch);
  w.i32(h.customVersionFormat);
  w.i32(h.customVersions.length);
  for (const cv of h.customVersions) {
    w.guid(cv.guid);
    w.i32(cv.version);
  }
  w.fstring(h.saveGameClassName);
}
