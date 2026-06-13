import { describe, it, expect } from "vitest";
import { normalizeConfidence, prettifyTagPath, deriveFacets, selectCounterTags, COLLECTIBLES } from "../src/collectibles.js";
import { decrypt } from "../src/crypt/index.js";
import { parse } from "../src/gvas/index.js";
import { readEnumArrayEntries } from "../src/gvas/scan.js";
import { SaveFile } from "../src/sav/index.js";
import { fx, hasFx } from "./helpers.js";

describe("collectibles helpers", () => {
  it("normalizes confidence labels", () => {
    expect(normalizeConfidence("medium")).toBe("med");
    expect(normalizeConfidence("med")).toBe("med");
    expect(normalizeConfidence("high")).toBe("high");
    expect(normalizeConfidence("low")).toBe("low");
    expect(normalizeConfidence("garbage")).toBe("low");
  });

  it("prettifies a tag path as a fallback name", () => {
    expect(prettifyTagPath("GameProgress.Definitions.GoldBricks.Story.01.05.01GB"))
      .toBe("Gold Bricks › Story › 01 › 05 › 01GB");
  });

  it("derives story facets from a story tag", () => {
    expect(deriveFacets("GameProgress.Definitions.GoldBricks.Story.01.05.01GB"))
      .toEqual({ source: "story", chapter: 1, mission: 5 });
  });

  it("derives hub facets (island + district) from a hub tag", () => {
    expect(deriveFacets("GameProgress.Definitions.WayneTechChips.Hub.TC.TC01.Exploration.WTC.00WTC"))
      .toEqual({ source: "hub", island: "Tri-Corner", district: "Tricorner" });
  });

  it("derives shop facet for ShopItems", () => {
    expect(deriveFacets("GameProgress.Definitions.ShopItems.Vehicles.Gordon.PoliceCruiser").source).toBe("shop");
  });

  it("treats non-island hub tags (MilestoneRewards) as hub with an area, not 'other'", () => {
    const f = deriveFacets("GameProgress.Definitions.GoldBricks.Hub.MilestoneRewards.FastTravel.01GB");
    expect(f.source).toBe("hub");
    expect(f.area).toBe("MilestoneRewards");
    expect(f.district).toBeUndefined();
  });
});

describe("selectCounterTags", () => {
  const universe = [
    "GameProgress.Definitions.Characters.Batman.Classic",
    "GameProgress.Definitions.Characters.Batman.ArkhamKnight",
    "GameProgress.Definitions.GoldBricks.Story.01.05.01GB",
  ];
  it("includes by prefix and applies excludes", () => {
    expect(selectCounterTags(universe, {
      include: ["GameProgress.Definitions.Characters."],
      exclude: ["GameProgress.Definitions.Characters.Batman.ArkhamKnight"],
    })).toEqual(["GameProgress.Definitions.Characters.Batman.Classic"]);
  });
  it("with no exclude returns all matching", () => {
    expect(selectCounterTags(universe, { include: ["GameProgress.Definitions.GoldBricks."] }))
      .toEqual(["GameProgress.Definitions.GoldBricks.Story.01.05.01GB"]);
  });
});

describe("COLLECTIBLES manifest (committed)", () => {
  it("has counters whose tags.length === counter", () => {
    expect(COLLECTIBLES.length).toBeGreaterThanOrEqual(8);
    for (const c of COLLECTIBLES) expect(c.tags.length, c.key).toBe(c.counter);
  });
  it("gold bricks is the only verified counter and has 30", () => {
    const gb = COLLECTIBLES.find((c) => c.key === "GoldBricks")!;
    expect(gb.verified).toBe(true);
    expect(gb.counter).toBe(30);
    expect(COLLECTIBLES.filter((c) => c.verified).length).toBe(1);
  });
  it("every tag is unique, named, and has valid confidence + state", () => {
    const seen = new Set<string>();
    for (const c of COLLECTIBLES) {
      expect(c.stateValue, c.key).toMatch(/^E[A-Za-z]+::[A-Za-z]+$/);
      for (const t of c.tags) {
        expect(seen.has(t.tag), `dup ${t.tag}`).toBe(false);
        seen.add(t.tag);
        expect(t.name.length, t.tag).toBeGreaterThan(0);
        expect(["high", "med", "low"]).toContain(t.confidence);
      }
    }
  });
});

// DLC / pre-order items that a non-DLC 100% save legitimately won't contain. The
// test's purpose is to catch typo'd/invalid tags, not to require DLC ownership.
const DLC_ABSENT_OK = new Set([
  "GameProgress.Definitions.Characters.Batman.DC27",
  "GameProgress.Definitions.Characters.Batman.BlackLantern",
  "GameProgress.Definitions.Characters.Batman.DarkKnightsOfSteel",
]);

describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("manifest vs 100% save", () => {
  const save = new Set(
    readEnumArrayEntries(parse(decrypt(fx("slot0_thirdparty_100pct.sav"))).body).map((e) => e.tag),
  );

  it("every manifest tag exists in the 100% save (modulo known DLC)", () => {
    for (const c of COLLECTIBLES)
      for (const t of c.tags)
        if (!DLC_ABSENT_OK.has(t.tag)) expect(save.has(t.tag), t.tag).toBe(true);
  });

  it("all 41 gameplay challenges are catalogued and present in the maxed save", () => {
    const ch = COLLECTIBLES.find((c) => c.key === "Challenges")!;
    expect(ch.counter).toBe(41);
    for (const t of ch.tags) expect(save.has(t.tag), t.tag).toBe(true);
  });
});

describe("SaveFile.addCollectibles (max-out)", () => {
  it("adds only missing tags, is idempotent, and round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const gb = COLLECTIBLES.find((c) => c.key === "GoldBricks")!;
    const allTags = gb.tags.map((t) => t.tag);
    const before = sf.enumArrayEntries().length;
    const added = sf.addCollectibles(allTags, gb.stateValue);
    expect(added).toBeGreaterThan(0);
    const after = sf.enumArrayEntries();
    expect(after.length).toBe(before + added);
    const have = new Set(after.map((e) => e.tag));
    for (const t of allTags) expect(have.has(t), t).toBe(true);
    // idempotent
    expect(sf.addCollectibles(allTags, gb.stateValue)).toBe(0);
    // round-trips cleanly
    expect(() => SaveFile.load(sf.toBytes())).not.toThrow();
  });
});

describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("insert a manifest collectible end-to-end", () => {
  it("inserts a gold brick the save lacks using the manifest's stateValue; count grows; round-trips", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const gb = COLLECTIBLES.find((c) => c.key === "GoldBricks")!;
    const have = new Set(sf.enumArrayEntries().map((e) => e.tag));
    const missing = gb.tags.find((t) => !have.has(t.tag))!;
    expect(missing, "a gold brick missing from the minimal fixture").toBeDefined();
    const templateTag = sf.enumArrayEntries()[0]!.tag;
    const before = sf.enumArrayEntries().length;
    sf.insertEnumEntry({ templateTag, newTag: missing.tag, newState: gb.stateValue });
    const after = sf.enumArrayEntries();
    expect(after.length).toBe(before + 1);
    expect(after.find((e) => e.tag === missing.tag)?.state).toBe(gb.stateValue);
    expect(SaveFile.load(sf.toBytes()).enumArrayEntries().some((e) => e.tag === missing.tag)).toBe(true);
  });
});
