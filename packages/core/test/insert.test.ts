import { describe, it, expect } from "vitest";
import { decrypt } from "../src/crypt/index.js";
import { parse } from "../src/gvas/index.js";
import { parseStructure, PropertyNode } from "../src/gvas/structure.js";
import { readEnumArrayEntries, insertEnumEntry } from "../src/gvas/scan.js";
import { SaveFile } from "../src/sav/index.js";
import { fx, hasFx } from "./helpers.js";

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

describe("readEnumArrayEntries", () => {
  it("reads every element's tag + state from the committed fixture", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const entries = readEnumArrayEntries(body);
    expect(entries.length).toBe(28);
    expect(entries[0]!.tag).toBe("GameProgress.Definitions.RoadClosures.Hub.Bridges.TCSI");
    expect(entries[0]!.state).toBe("ETtGameProgressUnlock::Unlocked");
  });
});

describe("insertEnumEntry — byte mechanics", () => {
  it("clones a template element under a new tag and grows the array by one", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const before = readEnumArrayEntries(body);
    const template = before[0]!;
    const newTag = template.tag + ".INSERTED.TEST.01X";

    const next = insertEnumEntry(body, { templateTag: template.tag, newTag });

    const after = readEnumArrayEntries(next);
    expect(after.length).toBe(before.length + 1);
    const inserted = after.find((e) => e.tag === newTag);
    expect(inserted, "inserted entry present").toBeDefined();
    expect(inserted!.state).toBe(template.state); // state cloned from template
    // every original entry survives untouched
    for (const e of before) {
      expect(after.some((a) => a.tag === e.tag && a.state === e.state), `original ${e.tag} survives`).toBe(true);
    }
  });

  it("can override the cloned state via newState", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const template = readEnumArrayEntries(body)[0]!;
    const next = insertEnumEntry(body, {
      templateTag: template.tag,
      newTag: "GameProgress.Definitions.Test.Override.01",
      newState: "ETtGameProgressUnlock::Collected",
    });
    const inserted = readEnumArrayEntries(next).find((e) => e.tag === "GameProgress.Definitions.Test.Override.01");
    expect(inserted!.state).toBe("ETtGameProgressUnlock::Collected");
  });

  it("keeps the body structurally walkable: count + array size + ancestors stay consistent", () => {
    const body = parse(decrypt(fx("slot1_prepatch.sav"))).body;
    const arrBefore = arrayNode(body);
    const cBefore = new DataView(body.buffer, body.byteOffset).getInt32(arrBefore.valueStart, true);

    const next = insertEnumEntry(body, {
      templateTag: readEnumArrayEntries(body)[0]!.tag,
      newTag: "GameProgress.Definitions.Test.Walk.01",
    });

    const arrAfter = arrayNode(next);
    const cAfter = new DataView(next.buffer, next.byteOffset).getInt32(arrAfter.valueStart, true);
    const delta = next.length - body.length;

    expect(cAfter).toBe(cBefore + 1); // element count int32 bumped
    expect(arrAfter.size).toBe(arrBefore.size + delta); // array Size grew by the new element's byte length
    expect(arrAfter.children!.length).toBe(cAfter); // re-walk agrees with count
  });

  it("round-trips through encrypt/decrypt via SaveFile", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const tag = readEnumArrayEntries(sf.doc.body)[0]!.tag;
    sf.insertEnumEntry({ templateTag: tag, newTag: "GameProgress.Definitions.Test.RoundTrip.01" });

    const reloaded = SaveFile.load(sf.toBytes());
    const entries = readEnumArrayEntries(reloaded.doc.body);
    expect(entries.some((e) => e.tag === "GameProgress.Definitions.Test.RoundTrip.01")).toBe(true);
    // re-serialization is stable (no drift)
    expect(SaveFile.load(reloaded.toBytes()).toBytes()).toEqual(reloaded.toBytes());
  });
});

// Real gold-brick scenario — the live-test substrate. Skips in CI (gitignored saves).
describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav") || !hasFx("slot0_patched.sav"))(
  "gold brick insertion (real saves)",
  () => {
    it("inserts a real candidate gold brick into the real save: 3 → 4, neighbours intact", () => {
      const full = parse(decrypt(fx("slot0_thirdparty_100pct.sav"))).body;
      const real = parse(decrypt(fx("slot0_patched.sav"))).body;

      const realEntries = readEnumArrayEntries(real);
      const realGB = realEntries.filter((e) => e.tag.includes("GoldBricks"));
      expect(realGB.length).toBe(3);

      const realTags = new Set(realEntries.map((e) => e.tag));
      const candidate = readEnumArrayEntries(full).find(
        (e) => e.tag.includes("GoldBricks.Story") && !realTags.has(e.tag),
      )!;
      expect(candidate, "a candidate gold brick exists in 100% but not in real save").toBeDefined();

      // Clone one of the real bricks (matching type/state), swap only the tag.
      const next = insertEnumEntry(real, { templateTag: realGB[0]!.tag, newTag: candidate.tag });

      const after = readEnumArrayEntries(next);
      expect(after.filter((e) => e.tag.includes("GoldBricks")).length).toBe(4);
      expect(after.some((e) => e.tag === candidate.tag)).toBe(true);
      for (const g of realGB) {
        expect(after.find((e) => e.tag === g.tag)?.state, `${g.tag} unchanged`).toBe(g.state);
      }
    });
  },
);
