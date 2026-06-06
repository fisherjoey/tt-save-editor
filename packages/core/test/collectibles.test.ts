import { describe, it, expect } from "vitest";
import { normalizeConfidence, prettifyTagPath, deriveFacets, selectCounterTags } from "../src/collectibles.js";

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
