import { describe, it, expect } from "vitest";
import { SaveFile } from "../src/sav/index.js";
import { summarizeChanges, hasChanges } from "../src/diff.js";
import { COLLECTIBLES } from "../src/collectibles.js";
import { fx } from "./helpers.js";

describe("summarizeChanges", () => {
  it("reports no changes between a save and itself", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const c = summarizeChanges(sf.doc.body, sf.doc.body);
    expect(hasChanges(c)).toBe(false);
    expect(c.added).toHaveLength(0);
    expect(c.scalars).toHaveLength(0);
  });

  it("detects added collectibles and a changed scalar", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const before = sf.doc.body.slice();
    const gb = COLLECTIBLES.find((c) => c.key === "GoldBricks")!;
    const have = new Set(sf.enumArrayEntries().map((e) => e.tag));
    const missing = gb.tags.filter((t) => !have.has(t.tag)).slice(0, 3).map((t) => t.tag);
    sf.addEntries(missing, gb.stateValue);
    const studs = sf.getField("StudsCollected") ?? sf.fields().find((f) => /stud/i.test(f.name));
    if (studs) sf.setFieldAll(studs.name, 123456);

    const c = summarizeChanges(before, sf.doc.body);
    expect(hasChanges(c)).toBe(true);
    // the 3 gold bricks show as added with the gold-brick state
    expect(c.added.map((a) => a.tag).sort()).toEqual([...missing].sort());
    expect(c.added.every((a) => a.state === gb.stateValue)).toBe(true);
    // studs changed
    if (studs) {
      const s = c.scalars.find((x) => x.name === studs.name);
      expect(s?.to).toBe("123456");
    }
  });

  it("detects an enum state flip on an existing entry", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const before = sf.doc.body.slice();
    const e = sf.enums().find((x) => x.enumType === "ETtGameProgressUnlock" && x.member !== "Collected");
    if (!e) return;
    sf.setEnum(e, "Collected");
    const c = summarizeChanges(before, sf.doc.body);
    expect(c.stateChanged.some((s) => s.to.endsWith("::Collected"))).toBe(true);
  });
});
