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

describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("manifest vs 100% save", () => {
  it("every manifest tag exists in the 100% save", () => {
    const save = new Set(
      readEnumArrayEntries(parse(decrypt(fx("slot0_thirdparty_100pct.sav"))).body).map((e) => e.tag),
    );
    for (const c of COLLECTIBLES) for (const t of c.tags) expect(save.has(t.tag), t.tag).toBe(true);
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
