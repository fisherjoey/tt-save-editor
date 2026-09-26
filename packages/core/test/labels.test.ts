import { describe, it, expect } from "vitest";
import { friendlyProgressName, prettifyKey } from "../src/index.js";
import { PROGRESS_NAMES } from "../src/data/progress-names.generated.js";

const P = "GameProgress.Definitions.";
// Tags guaranteed absent from the curated table, so the fallback branches run.
const absent = (tag: string) => {
  expect(PROGRESS_NAMES[tag]).toBeUndefined();
  return tag;
};

describe("friendlyProgressName", () => {
  it("returns the curated name unchanged when the tag is in PROGRESS_NAMES", () => {
    const [tag, name] = Object.entries(PROGRESS_NAMES)[0]!;
    expect(friendlyProgressName(tag)).toBe(name);
  });

  it("falls back to 'Objective N' for a bare OBJnn tail", () => {
    expect(friendlyProgressName(absent(`${P}Zzz.Test.OBJ07`))).toBe("Objective 7");
  });

  it("adds a '(part ...)' suffix for sub-steps", () => {
    expect(friendlyProgressName(absent(`${P}Zzz.Test.OBJ02.B`))).toBe("Objective 2 (part B)");
    expect(friendlyProgressName(absent(`${P}Zzz.Test.OBJ02.B.03`))).toBe("Objective 2 (part B-3)");
  });

  it("names Gamewide.100Percent as overall completion", () => {
    expect(friendlyProgressName(absent(`${P}Gamewide.100Percent`))).toBe("Overall 100% completion");
  });

  it("names Story.CC.MM tags as story missions, with optional variant letter", () => {
    expect(friendlyProgressName(absent(`${P}Story.99.04`))).toBe("Story mission 99-4");
    expect(friendlyProgressName(absent(`${P}Story.99.04B`))).toBe("Story mission 99-4 (part B)");
  });

  it("decodes island codes and prettifies unrecognized paths", () => {
    const tag = absent(`${P}Zzz.CI.NI.SI.TC`);
    const out = friendlyProgressName(tag);
    expect(out).toBe(prettifyKey("Zzz.Central Island.North Island.South Island.Tricorner"));
    for (const n of ["Central Island", "North Island", "South Island", "Tricorner"]) {
      expect(out).toContain(n);
    }
  });

  it("appends ' (100% marker)' for CompletionBadge on every branch", () => {
    expect(friendlyProgressName(absent(`${P}Zzz.Test.OBJ01.CompletionBadge`))).toBe("Objective 1 (100% marker)");
    expect(friendlyProgressName(absent(`${P}Gamewide.100Percent.CompletionBadge`))).toBe(
      "Overall 100% completion (100% marker)",
    );
    expect(friendlyProgressName(absent(`${P}Story.99.04.CompletionBadge`))).toBe("Story mission 99-4 (100% marker)");
    expect(friendlyProgressName(absent(`${P}Zzz.CI.CompletionBadge`))).toBe(
      prettifyKey("Zzz.Central Island") + " (100% marker)",
    );
  });
});
