import { describe, it, expect } from "vitest";
import { decrypt } from "../src/crypt/index.js";
import { parse } from "../src/gvas/index.js";
import { parseStructure, PropertyNode } from "../src/gvas/structure.js";
import { readEnumArrayEntries, insertEnumEntriesBatch, removeEnumEntriesBatch } from "../src/gvas/scan.js";
import { SaveFile } from "../src/sav/index.js";
import { fx } from "./helpers.js";

/** Locate the SavedGameProgressEnumValues array node anywhere in the tree. */
function arrayNode(body: Uint8Array): PropertyNode {
  const stack = [...parseStructure(body)];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.name === "SavedGameProgressEnumValues" && n.children?.length) return n;
    if (n.children) stack.push(...n.children);
  }
  throw new Error("SavedGameProgressEnumValues not found");
}

const count = (body: Uint8Array, arr: PropertyNode) => new DataView(body.buffer, body.byteOffset).getInt32(arr.valueStart, true);

describe("removeEnumEntriesBatch — byte mechanics", () => {
  it("drops a matching element and shrinks the array by one; others survive", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const before = readEnumArrayEntries(body);
    const victim = before[1]!; // a Challenges.* entry

    const next = removeEnumEntriesBatch(body, [victim.tag]);

    const after = readEnumArrayEntries(next);
    expect(after.length).toBe(before.length - 1);
    expect(after.some((e) => e.tag === victim.tag)).toBe(false);
    for (const e of before) {
      if (e.tag === victim.tag) continue;
      expect(after.some((a) => a.tag === e.tag && a.state === e.state), `${e.tag} survives`).toBe(true);
    }
  });

  it("keeps the body structurally walkable: count + array size + ancestors stay consistent", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const arrBefore = arrayNode(body);
    const cBefore = count(body, arrBefore);
    const victim = readEnumArrayEntries(body)[2]!;

    const next = removeEnumEntriesBatch(body, [victim.tag]);

    const arrAfter = arrayNode(next);
    const delta = body.length - next.length; // bytes removed
    expect(count(next, arrAfter)).toBe(cBefore - 1);
    expect(arrAfter.size).toBe(arrBefore.size - delta);
    expect(arrAfter.children!.length).toBe(cBefore - 1);
  });

  it("removes several entries at once", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const before = readEnumArrayEntries(body);
    const victims = [before[1]!.tag, before[3]!.tag, before[5]!.tag];

    const next = removeEnumEntriesBatch(body, victims);
    const after = readEnumArrayEntries(next);

    expect(after.length).toBe(before.length - 3);
    for (const v of victims) expect(after.some((e) => e.tag === v)).toBe(false);
  });

  it("is a no-op for tags that aren't present", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const next = removeEnumEntriesBatch(body, ["GameProgress.Definitions.Nope.NotHere.01"]);
    expect(next).toBe(body); // same reference — nothing to do
  });

  it("insert-then-remove is byte-for-byte identity (strong inverse invariant)", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const newTag = "GameProgress.Definitions.Test.Inverse.01X";
    const inserted = insertEnumEntriesBatch(body, [newTag], "ETtCollectableGameProgressState::Collected");
    expect(inserted.length).toBeGreaterThan(body.length);
    const restored = removeEnumEntriesBatch(inserted, [newTag]);
    expect(restored).toEqual(body);
  });
});

describe("SaveFile.removeEntries", () => {
  it("removes an entry and round-trips through encrypt/decrypt", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const victim = readEnumArrayEntries(sf.doc.body).find((e) => e.tag.includes("Challenges"))!.tag;

    const removed = sf.removeEntries([victim]);
    expect(removed).toBe(1);

    const reloaded = SaveFile.load(sf.toBytes());
    expect(readEnumArrayEntries(reloaded.doc.body).some((e) => e.tag === victim)).toBe(false);
    // re-serialization is stable (no drift)
    expect(SaveFile.load(reloaded.toBytes()).toBytes()).toEqual(reloaded.toBytes());
  });

  it("reports how many were actually removed (ignores absent tags)", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const present = readEnumArrayEntries(sf.doc.body)[1]!.tag;
    expect(sf.removeEntries([present, "GameProgress.Definitions.Absent.X"])).toBe(1);
  });

  it("add then remove via SaveFile returns the original bytes", () => {
    const original = SaveFile.load(fx("slot1_prepatch.sav")).toBytes();
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    sf.addEntries(["GameProgress.Definitions.Test.SfInverse.01"], "ETtCollectableGameProgressState::Collected");
    sf.removeEntries(["GameProgress.Definitions.Test.SfInverse.01"]);
    expect(sf.toBytes()).toEqual(original);
  });
});
