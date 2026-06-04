import { Keystream, decrypt, encrypt } from "../crypt/index.js";
import { GvasDocument, parse, serialize, scanFields, findField, setFixedValue, setStringValue, ScalarField } from "../gvas/index.js";

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
    readonly keystream: Keystream,
    /** The exact ciphertext we loaded, for the round-trip self-check. */
    private readonly originalCipher: Uint8Array,
  ) {}

  static load(cipher: Uint8Array, keystream: Keystream): SaveFile {
    const plain = decrypt(cipher, keystream, { allowPartial: true });
    const doc = parse(plain);
    const sf = new SaveFile(doc, keystream, cipher);
    // Prove we can reproduce the input before allowing any edits.
    if (!eq(sf.toBytes(), cipher)) throw new RoundTripError();
    return sf;
  }

  fields(): ScalarField[] {
    return scanFields(this.doc.body);
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

  /** Re-encrypt. Self-checks that a no-op save reproduces the original ciphertext. */
  toBytes(): Uint8Array {
    return encrypt(serialize(this.doc), this.keystream, { allowPartial: true });
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
