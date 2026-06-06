import { decrypt, encrypt } from "../crypt/index.js";
import {
  GvasDocument,
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
  ScalarField,
  EnumField,
  EnumArrayEntry,
  EnumEntryInsertion,
} from "../gvas/index.js";
import { enumMeta } from "../enums.js";

export class RoundTripError extends Error {
  constructor() {
    super("Internal round-trip check failed — refusing to emit a save that would not load. This is a bug; please report it.");
    this.name = "RoundTripError";
  }
}

/**
 * A loaded save: decrypted header + body, with the keystream kept so we can re-encrypt.
 * All edits go through this; `toBytes()` re-encrypts and self-checks the round-trip
 * before handing back bytes, so a corrupt save can never leave the tool.
 */
export class SaveFile {
  private constructor(
    public doc: GvasDocument,
    /** The exact ciphertext we loaded, for the round-trip self-check. */
    private readonly originalCipher: Uint8Array,
  ) {}

  static load(cipher: Uint8Array): SaveFile {
    const plain = decrypt(cipher);
    const doc = parse(plain);
    const sf = new SaveFile(doc, cipher);
    // Prove we can reproduce the input before allowing any edits.
    if (!eq(sf.toBytes(), cipher)) throw new RoundTripError();
    return sf;
  }

  fields(): ScalarField[] {
    return scanFields(this.doc.body);
  }

  enums(): EnumField[] {
    return scanEnums(this.doc.body);
  }

  /** Members observed per enum type in this save (for richer dropdowns). */
  observedEnums(): Map<string, Set<string>> {
    return observedEnumMembers(this.enums());
  }

  /** Set an enum field (located by its current byte offset) to a new member. */
  setEnum(field: EnumField, member: string): this {
    this.doc.body = setEnumValue(this.doc.body, field, member);
    return this;
  }

  /**
   * Set many enum fields to the same member at once (e.g. "complete all challenges").
   * Applies from the highest offset down so each splice can't invalidate the offsets
   * of fields not yet edited.
   */
  setEnumsBulk(fields: EnumField[], member: string): this {
    for (const f of [...fields].sort((a, b) => b.valueOffset - a.valueOffset)) {
      this.doc.body = setEnumValue(this.doc.body, f, member);
    }
    return this;
  }

  /**
   * One-click "complete everything": set every progress enum to its completion
   * value (collectibles → Collected, challenges → Completed, etc.). Returns the
   * number of fields changed.
   */
  completeAllProgress(): number {
    let n = 0;
    const all = this.enums();
    for (const enumType of new Set(all.map((e) => e.enumType))) {
      const meta = enumMeta(enumType);
      if (meta.category !== "progress" || !meta.completeValue) continue;
      const fields = this.enums().filter((e) => e.enumType === enumType && e.member !== meta.completeValue);
      if (!fields.length) continue;
      this.setEnumsBulk(fields, meta.completeValue);
      n += fields.length;
    }
    return n;
  }

  /** Every collectible entry (tag + state) in the save's enum array(s). */
  enumArrayEntries(): EnumArrayEntry[] {
    return readEnumArrayEntries(this.doc.body);
  }

  /**
   * Add a new collectible entry by cloning an existing sibling and swapping its
   * tag (this is what actually moves displayed counters — gold bricks, Wayne Tech
   * chips, trophies, minikits — since the game counts array membership, not state).
   */
  insertEnumEntry(ins: EnumEntryInsertion): this {
    this.doc.body = insertEnumEntry(this.doc.body, ins);
    return this;
  }

  getField(name: string): ScalarField | undefined {
    return findField(this.fields(), name);
  }

  /** Set a scalar field by name. Throws if not found. Re-scans so offsets stay valid. */
  setField(name: string, value: number | bigint | boolean | string): this {
    const f = this.getField(name);
    if (!f) throw new Error(`Field "${name}" not found in save`);
    this.doc.body = f.kind === "string" ? setStringValue(this.doc.body, f, String(value)) : setFixedValue(this.doc.body, f, value as number | bigint | boolean);
    return this;
  }

  /** Set EVERY field with the given name to the same value (some saves store
   *  the wallet in multiple denormalized places). Re-scans after each write so
   *  any offset shifts from string edits stay valid. */
  setFieldAll(name: string, value: number | bigint | boolean | string): this {
    for (;;) {
      const target = this.fields().find((f) => f.name === name && String(f.value) !== String(value));
      if (!target) break;
      this.doc.body = target.kind === "string" ? setStringValue(this.doc.body, target, String(value)) : setFixedValue(this.doc.body, target, value as number | bigint | boolean);
    }
    return this;
  }

  /** Re-encrypt. Self-checks that a no-op save reproduces the original ciphertext. */
  toBytes(): Uint8Array {
    return encrypt(serialize(this.doc));
  }

  /** The matching BackupCopy_* file (the game cross-checks the pair). Identical bytes. */
  backupBytes(): Uint8Array {
    return this.toBytes();
  }

  isUnmodified(): boolean {
    return eq(this.toBytes(), this.originalCipher);
  }
}

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
