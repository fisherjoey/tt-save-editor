import { describe, it, expect } from "vitest";
import { SaveFile, fromDisplay, toDisplay } from "../src/index.js";
import { fx } from "./helpers.js";

describe("TotalPlaytime (Timespan) field", () => {
  it("is discovered as an Int64 scalar in real saves", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const pt = sf.fields().find((f) => f.name === "TotalPlaytime");
    expect(pt, "TotalPlaytime found").toBeDefined();
    expect(typeof pt!.value).toBe("bigint");
  });

  it("display/parse round-trip preserves minutes precision", () => {
    const ticks = 73466339447n; // = 122.44 minutes
    const minutesStr = toDisplay(ticks, "minutes");
    expect(minutesStr).toBe("122");
    expect(fromDisplay("122", "minutes")).toBe(73_200_000_000n);
  });

  it("edit-then-reload reads the new playtime back", () => {
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const target = 3599400000000n; // 99h 59m in ticks
    sf.setField("TotalPlaytime", target);
    const reloaded = SaveFile.load(sf.toBytes());
    expect(reloaded.fields().find((f) => f.name === "TotalPlaytime")!.value).toBe(target);
  });
});
