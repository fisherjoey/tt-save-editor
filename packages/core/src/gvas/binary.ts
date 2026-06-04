/** Little-endian binary reader/writer for UE GVAS. All multi-byte values are LE. */

export class BinaryReader {
  pos = 0;
  private view: DataView;
  constructor(public buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  get remaining(): number {
    return this.buf.length - this.pos;
  }
  bytes(n: number): Uint8Array {
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  u8(): number {
    return this.buf[this.pos++]!;
  }
  u16(): number {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  i32(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  u32(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i64(): bigint {
    const v = this.view.getBigInt64(this.pos, true);
    this.pos += 8;
    return v;
  }
  u64(): bigint {
    const v = this.view.getBigUint64(this.pos, true);
    this.pos += 8;
    return v;
  }
  f32(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64(): number {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  guid(): Uint8Array {
    return this.bytes(16).slice();
  }
  /** FString: i32 length. >=0 => UTF-8 (length bytes incl. trailing NUL). <0 => UTF-16 (-length chars). 0 => empty. */
  fstring(): string {
    const len = this.i32();
    if (len === 0) return "";
    if (len > 0) {
      const raw = this.bytes(len);
      // drop trailing NUL
      return new TextDecoder("utf-8").decode(raw.subarray(0, len - 1));
    }
    const chars = -len;
    const raw = this.bytes(chars * 2);
    return new TextDecoder("utf-16le").decode(raw.subarray(0, raw.length - 2));
  }
}

export class BinaryWriter {
  private parts: Uint8Array[] = [];
  private len = 0;
  private push(b: Uint8Array) {
    this.parts.push(b);
    this.len += b.length;
  }
  private scalar(n: number, fn: (v: DataView) => void): void {
    const b = new Uint8Array(n);
    fn(new DataView(b.buffer));
    this.push(b);
  }
  bytes(b: Uint8Array): void {
    this.push(b);
  }
  u8(v: number): void {
    this.push(Uint8Array.of(v & 0xff));
  }
  u16(v: number): void {
    this.scalar(2, (d) => d.setUint16(0, v, true));
  }
  i32(v: number): void {
    this.scalar(4, (d) => d.setInt32(0, v, true));
  }
  u32(v: number): void {
    this.scalar(4, (d) => d.setUint32(0, v, true));
  }
  i64(v: bigint): void {
    this.scalar(8, (d) => d.setBigInt64(0, v, true));
  }
  u64(v: bigint): void {
    this.scalar(8, (d) => d.setBigUint64(0, v, true));
  }
  f32(v: number): void {
    this.scalar(4, (d) => d.setFloat32(0, v, true));
  }
  f64(v: number): void {
    this.scalar(8, (d) => d.setFloat64(0, v, true));
  }
  guid(g: Uint8Array): void {
    this.push(g);
  }
  /** Mirror of BinaryReader.fstring. ASCII strings round-trip as UTF-8+NUL; others as UTF-16. */
  fstring(s: string): void {
    if (s.length === 0) {
      this.i32(0);
      return;
    }
    // eslint-disable-next-line no-control-regex
    const ascii = /^[\x00-\x7f]*$/.test(s);
    if (ascii) {
      const body = new TextEncoder().encode(s);
      this.i32(body.length + 1);
      this.push(body);
      this.u8(0);
    } else {
      this.i32(-(s.length + 1));
      const u16 = new Uint8Array((s.length + 1) * 2);
      const dv = new DataView(u16.buffer);
      for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true);
      this.push(u16);
    }
  }
  toBytes(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}
