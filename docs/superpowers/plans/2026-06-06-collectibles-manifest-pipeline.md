# Collectibles Manifest Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a committed, validated `collectibles` catalogue (tags + display names + per-counter grouping) that the future Collectibles panel consumes to insert collectibles and move in-game counters.

**Architecture:** A hand-authored counter→category mapping table + a maintainer build script fuse three local-only inputs (the 100% save's tag universe/counts/state, the pre-derived tag→name map, and the mapping table) into a committed `collectibles.generated.ts`. A CI test validates the committed artifact with no game files needed.

**Tech Stack:** TypeScript, Node + `tsx` (scripts), Vitest (tests), the existing `@tt-save/core` package (`readEnumArrayEntries`, `parse`, `decrypt`).

---

## File Structure

- `packages/core/src/data/collectible-names.json` — **create** (committed input): the merged tag→{name,confidence,source} map (3,340 tags).
- `packages/core/src/collectibles.ts` — **create**: public types (`CollectibleCounter`, `CollectibleTag`, `Confidence`) + `COLLECTIBLES` re-export + pure helpers (`normalizeConfidence`, `prettifyTagPath`, `deriveFacets`, `selectCounterTags`).
- `packages/core/src/data/collectibles-mapping.ts` — **create**: the hand-authored counter mapping table + the district map constant.
- `packages/core/src/data/collectibles.generated.ts` — **create** (generated, committed): `export const COLLECTIBLES`.
- `packages/core/scripts/build-collectibles-manifest.ts` — **create**: the build script (reads save + name map + mapping → writes generated.ts).
- `packages/core/scripts/derive-collectible-names/` — **create**: cleaned derivation scripts + `README.md` documenting the `retoc` procedure (reproducibility; never run in CI).
- `packages/core/test/collectibles.test.ts` — **create**: pure-helper unit tests + CI manifest validation + round-trip test.
- `packages/core/src/index.ts` & `packages/core/src/gvas/index.ts` — **modify**: export the new public surface.

---

## Task 1: Bring the derived inputs into the repo

**Files:**
- Create: `packages/core/src/data/collectible-names.json`
- Create: `packages/core/scripts/derive-collectible-names/README.md` (+ copied scripts)

- [ ] **Step 1: Copy the merged name map + derivation scripts into the repo**

```bash
cd /home/joey/dev/personal/tt-save-editor
mkdir -p packages/core/src/data packages/core/scripts/derive-collectible-names
cp ~/.local/share/tt-save-editor/collectible-names/collectible-names.merged.json packages/core/src/data/collectible-names.json
cp ~/.local/share/tt-save-editor/collectible-names/ttx_*.py packages/core/scripts/derive-collectible-names/ 2>/dev/null || true
```

- [ ] **Step 2: Write the derivation README**

Create `packages/core/scripts/derive-collectible-names/README.md`:

```markdown
# Collectible names derivation (maintainer-only, not CI)

Regenerates `src/data/collectible-names.json` from the game's UE5 paks after a game patch.

## Prereqs (local only)
- `cargo install --git https://github.com/trumank/repak repak_cli`
- `cargo install --git https://github.com/trumank/retoc`
- Game paks: `<install>/LEGOBatmanLotDK/Content/Paks` (UE5.6 IoStore, no AES, Oodle auto-handled by retoc)
- The 100% save fixture (for the target tag list)

## Procedure
1. Extract name-bearing assets (asset PATHS carry the names):
   `retoc to-legacy --version UE5_6 --no-shaders --filter <substr> "<PaksDir>" /tmp/out`
   Key namespaces: `GameProgress` (story `PROG_CC_MM_<Mission>` paths), `Character`, `Vehicle`.
2. Derive names per category using the four methods (story-mission / hub-district / entity-from-tag / activities). District map is in `src/data/collectibles-mapping.ts`.
3. Output the merged `{tag: {name, confidence, source}}` to `src/data/collectible-names.json`.

CI and `pnpm build` never run this; they consume the committed JSON.
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/data/collectible-names.json packages/core/scripts/derive-collectible-names/
git commit -m "data: commit derived collectible name map + derivation docs"
```

---

## Task 2: Manifest types, helpers, and the mapping table

**Files:**
- Create: `packages/core/src/collectibles.ts`
- Create: `packages/core/src/data/collectibles-mapping.ts`
- Test: `packages/core/test/collectibles.test.ts`

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `packages/core/test/collectibles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeConfidence, prettifyTagPath, deriveFacets } from "../src/collectibles.js";

describe("collectibles helpers", () => {
  it("normalizes confidence labels", () => {
    expect(normalizeConfidence("medium")).toBe("med");
    expect(normalizeConfidence("med")).toBe("med");
    expect(normalizeConfidence("high")).toBe("high");
    expect(normalizeConfidence("low")).toBe("low");
  });

  it("prettifies a tag path as a fallback name", () => {
    expect(prettifyTagPath("GameProgress.Definitions.GoldBricks.Story.01.05.01GB"))
      .toBe("Gold Bricks › Story › 01 › 05 › 01GB");
  });

  it("derives story facets from a story tag", () => {
    const f = deriveFacets("GameProgress.Definitions.GoldBricks.Story.01.05.01GB");
    expect(f).toEqual({ source: "story", chapter: 1, mission: 5 });
  });

  it("derives hub facets (island + district) from a hub tag", () => {
    const f = deriveFacets("GameProgress.Definitions.WayneTechChips.Hub.TC.TC01.Exploration.WTC.00WTC");
    expect(f).toEqual({ source: "hub", island: "Tri-Corner", district: "Tricorner" });
  });

  it("derives shop facet for ShopItems", () => {
    expect(deriveFacets("GameProgress.Definitions.ShopItems.Vehicles.Gordon.PoliceCruiser").source).toBe("shop");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/core && npx vitest run test/collectibles.test.ts`
Expected: FAIL — `normalizeConfidence is not a function` (module missing).

- [ ] **Step 3: Write the mapping table + district constant**

Create `packages/core/src/data/collectibles-mapping.ts`:

```typescript
/** Island code → display name (top-level region in hub tags: .Hub.<ISLAND>.<DISTRICT>). */
export const ISLANDS: Record<string, string> = {
  TC: "Tri-Corner", SI: "South Island", NI: "North Island", CI: "Central Island",
};

/** Sub-district code → display name (from the game's UI_HUB_DISTRICT string table). */
export const DISTRICTS: Record<string, string> = {
  TC01: "Tricorner",
  OG01: "Old Gotham North", OG02: "Old Gotham South", OG03: "Old Gotham West",
  CA01: "The Cauldron Central", CA02: "The Cauldron South", CAAC: "The Cauldron North - ACE Chemicals",
  NT01: "Newtown", GVRP: "Gotham Village - Robinson Park", EEAM: "East End - Amusement Mile",
  OT01: "Otisburg", BC: "The Batcave",
};

/** How each in-game counter maps to gameplay-tag families.
 *  `include`/`exclude` are substring tests against the full tag.
 *  `stateCategory` is the `GameProgress.Definitions.<X>` whose canonical "collected"
 *  state is used as the insert value (derived from the 100% save at build time).
 *  `counter` is the known in-game /N — the build asserts selected tags === counter. */
export interface CounterMapping {
  key: string;
  label: string;
  counter: number;
  verified: boolean;
  stateCategory: string;
  include: string[];
  exclude?: string[];
}

export const COUNTER_MAPPINGS: CounterMapping[] = [
  { key: "GoldBricks", label: "Gold bricks", counter: 30, verified: true, stateCategory: "GoldBricks",
    include: ["GameProgress.Definitions.GoldBricks."] },
  { key: "RedBricks", label: "Red bricks", counter: 23, verified: false, stateCategory: "RedBricks",
    include: ["GameProgress.Definitions.RedBricks."] },
  { key: "Minikits", label: "Minikits", counter: 121, verified: false, stateCategory: "RiddlerTrophies",
    include: ["GameProgress.Definitions.RiddlerTrophies."] },
  { key: "WayneTechChips", label: "Wayne Tech chips", counter: 200, verified: false, stateCategory: "WayneTechChips",
    include: ["GameProgress.Definitions.WayneTechChips."] },
  { key: "Vehicles", label: "Vehicles", counter: 30, verified: false, stateCategory: "ShopItems",
    include: ["GameProgress.Definitions.ShopItems.Vehicles."] },
  { key: "StudCaches", label: "Stud caches", counter: 100, verified: false, stateCategory: "StudCaches",
    include: ["GameProgress.Definitions.StudCaches."] },
  { key: "BatTokens", label: "Bat tokens", counter: 65, verified: false, stateCategory: "BatTokens",
    include: ["GameProgress.Definitions.BatTokens."] },
  // Costumes + Trophies are filled in by Tasks 3 & 4 (counts must resolve before the build asserts pass).
];
```

- [ ] **Step 4: Write `collectibles.ts` (types + helpers + COLLECTIBLES re-export)**

Create `packages/core/src/collectibles.ts`:

```typescript
import { COLLECTIBLES as GENERATED } from "./data/collectibles.generated.js";
import { ISLANDS, DISTRICTS } from "./data/collectibles-mapping.js";

export type Confidence = "high" | "med" | "low";

export interface CollectibleFacets {
  source: "story" | "hub" | "shop" | "other";
  chapter?: number;
  mission?: number;
  island?: string;
  district?: string;
}

export interface CollectibleTag {
  tag: string;
  name: string;
  confidence: Confidence;
  facets: CollectibleFacets;
}

export interface CollectibleCounter {
  key: string;
  label: string;
  counter: number;
  verified: boolean;
  stateValue: string;
  tags: CollectibleTag[];
}

/** The committed, generated catalogue. */
export const COLLECTIBLES: CollectibleCounter[] = GENERATED;

export function normalizeConfidence(c: string): Confidence {
  if (c === "medium") return "med";
  if (c === "high" || c === "med" || c === "low") return c;
  return "low";
}

/** Fallback display name from a tag (drops the GameProgress.Definitions prefix). */
export function prettifyTagPath(tag: string): string {
  const rest = tag.replace(/^GameProgress\.Definitions\./, "");
  return rest
    .split(".")
    .map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
    .join(" › ");
}

/** Parse grouping facets from a tag. */
export function deriveFacets(tag: string): CollectibleFacets {
  if (tag.includes(".ShopItems.")) return { source: "shop" };
  const story = tag.match(/\.Story\.(\d+)\.(\d+)\./);
  if (story) return { source: "story", chapter: Number(story[1]), mission: Number(story[2]) };
  const hub = tag.match(/\.Hub\.([A-Z]+)\.([A-Z0-9]+)\./);
  if (hub) {
    const island = ISLANDS[hub[1]!];
    const district = DISTRICTS[hub[2]!];
    return { source: "hub", ...(island ? { island } : {}), ...(district ? { district } : {}) };
  }
  return { source: "other" };
}
```

- [ ] **Step 5: Create a temporary empty generated manifest so the module imports**

Create `packages/core/src/data/collectibles.generated.ts`:

```typescript
import type { CollectibleCounter } from "../collectibles.js";
// Regenerated by scripts/build-collectibles-manifest.ts — do not edit by hand.
export const COLLECTIBLES: CollectibleCounter[] = [];
```

(Note: `collectibles.generated.ts` imports the type from `collectibles.ts`, which imports the const back — this is a type-only cycle and is fine. If the compiler complains, change the generated file's import to `import type { CollectibleCounter } from "../collectibles.js"` which is already the case.)

- [ ] **Step 6: Run the test to confirm it passes**

Run: `cd packages/core && npx vitest run test/collectibles.test.ts`
Expected: PASS (5 helper tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/collectibles.ts packages/core/src/data/collectibles-mapping.ts packages/core/src/data/collectibles.generated.ts packages/core/test/collectibles.test.ts
git commit -m "feat(core): collectibles manifest types, helpers, counter mapping table"
```

---

## Task 3: Resolve the Trophies (170) counter composition

**Files:**
- Modify: `packages/core/src/data/collectibles-mapping.ts`

- [ ] **Step 1: Run the composition finder against the 100% save**

Create and run `/tmp/find-trophies.ts`:

```typescript
import { decrypt } from "/home/joey/dev/personal/tt-save-editor/packages/core/src/crypt/index.ts";
import { parse } from "/home/joey/dev/personal/tt-save-editor/packages/core/src/gvas/index.ts";
import { readEnumArrayEntries } from "/home/joey/dev/personal/tt-save-editor/packages/core/src/gvas/scan.ts";
import { readFileSync } from "node:fs";
const body = parse(decrypt(new Uint8Array(readFileSync(
  "/home/joey/dev/personal/tt-save-editor/packages/core/test/fixtures/slot0_thirdparty_100pct.sav")))).body;
const cats: Record<string, number> = {};
for (const e of readEnumArrayEntries(body)) {
  const m = e.tag.match(/^GameProgress\.Definitions\.([^.]+)\./);
  if (m) cats[m[1]!] = (cats[m[1]!] ?? 0) + 1;
}
// Print categories whose counts could sum to 170 (trophy-like: Micro/Trophy/Batcave).
console.log(Object.entries(cats).filter(([k]) => /micro|trophy|tro/i.test(k)).sort());
console.log("all:", Object.entries(cats).sort((a,b)=>b[1]-a[1]));
```

Run: `cd packages/core && npx --yes tsx /tmp/find-trophies.ts`
Success criterion: identify the exact set of category keys whose counts sum to **170**. (Candidates from prior analysis: `MicroBuilds` 125 + `BatcaveTrophy` 24 + a third group of 21. Inspect the printed list and confirm the sum.)

- [ ] **Step 2: Add the resolved Trophies mapping**

Append to `COUNTER_MAPPINGS` in `packages/core/src/data/collectibles-mapping.ts` (replace `<RESOLVED...>` with the categories found in Step 1 — they MUST sum to 170):

```typescript
  { key: "Trophies", label: "Trophies", counter: 170, verified: false, stateCategory: "MicroBuilds",
    include: [/* e.g. */ "GameProgress.Definitions.MicroBuilds.", "GameProgress.Definitions.Microbuilds.", "GameProgress.Definitions.BatcaveTrophy." /* + any third group needed to reach 170 */] },
```

- [ ] **Step 3: Verify the selection sums to 170**

Add to `/tmp/find-trophies.ts` a line that counts tags matching your `include` list and prints the total; rerun. Expected: `170`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/data/collectibles-mapping.ts
git commit -m "feat(core): resolve Trophies(170) counter composition"
```

---

## Task 4: Resolve the Costumes (101) DLC split

**Files:**
- Create: `packages/core/src/data/collectibles-dlc-exclude.json`
- Modify: `packages/core/src/data/collectibles-mapping.ts`

- [ ] **Step 1: Extract the DLC Character assets to identify DLC tags**

```bash
PAKS="/run/media/joey/Blue/Games/LEGO Batman - Legacy of the Dark Knight/LEGOBatmanLotDK/Content/Paks"
retoc to-legacy --version UE5_6 --no-shaders --filter DLC_ "$PAKS" /tmp/ttx_dlc 2>&1 | tail -2
# List DLC character asset names; map them to Characters.* tags by their trailing segments.
find /tmp/ttx_dlc -ipath '*Character*' -iname '*.uasset' | sed 's#.*/##; s#\.uasset$##' | sort -u
```

Success criterion: produce the list of `Characters.*` tags that are DLC, such that `125 − (DLC count) === 101`. If the asset-path method is inconclusive, fall back to: the 24 `Characters.*` tags **absent** from a base-game (non-DLC) save, or accept best-effort and document.

- [ ] **Step 2: Write the exclude list**

Create `packages/core/src/data/collectibles-dlc-exclude.json` — a JSON array of the full DLC `Characters.*` tags identified (must be exactly 24 so base = 101):

```json
[
  "GameProgress.Definitions.Characters.Batman.ArkhamKnight"
]
```

- [ ] **Step 3: Add the Costumes mapping using the exclude list**

In `packages/core/src/data/collectibles-mapping.ts`, import and use the exclude list:

```typescript
import dlcExclude from "./collectibles-dlc-exclude.json" with { type: "json" };
// ...append to COUNTER_MAPPINGS:
  { key: "Costumes", label: "Costumes", counter: 101, verified: false, stateCategory: "Characters",
    include: ["GameProgress.Definitions.Characters."], exclude: dlcExclude as string[] },
```

(If the repo's tsconfig lacks JSON import support, inline the array as a `const DLC_COSTUMES: string[]` in the mapping file instead.)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/data/collectibles-dlc-exclude.json packages/core/src/data/collectibles-mapping.ts
git commit -m "feat(core): resolve Costumes(101) base/DLC split"
```

---

## Task 5: Build script with TDD'd selection helper

**Files:**
- Create: `packages/core/scripts/build-collectibles-manifest.ts`
- Modify: `packages/core/src/collectibles.ts` (add `selectCounterTags`)
- Test: `packages/core/test/collectibles.test.ts`

- [ ] **Step 1: Write the failing test for `selectCounterTags`**

Append to `packages/core/test/collectibles.test.ts`:

```typescript
import { selectCounterTags } from "../src/collectibles.js";

describe("selectCounterTags", () => {
  const universe = [
    "GameProgress.Definitions.Characters.Batman.Classic",
    "GameProgress.Definitions.Characters.Batman.ArkhamKnight",
    "GameProgress.Definitions.GoldBricks.Story.01.05.01GB",
  ];
  it("includes by prefix and applies excludes", () => {
    const got = selectCounterTags(universe,
      { include: ["GameProgress.Definitions.Characters."], exclude: ["GameProgress.Definitions.Characters.Batman.ArkhamKnight"] });
    expect(got).toEqual(["GameProgress.Definitions.Characters.Batman.Classic"]);
  });
});
```

- [ ] **Step 2: Run it; expect FAIL** (`selectCounterTags is not a function`).

Run: `cd packages/core && npx vitest run test/collectibles.test.ts`

- [ ] **Step 3: Implement `selectCounterTags` in `collectibles.ts`**

```typescript
export function selectCounterTags(
  universe: string[],
  m: { include: string[]; exclude?: string[] },
): string[] {
  const ex = m.exclude ?? [];
  return universe.filter(
    (t) => m.include.some((p) => t.startsWith(p)) && !ex.some((p) => t === p || t.startsWith(p)),
  );
}
```

- [ ] **Step 4: Run it; expect PASS.**

- [ ] **Step 5: Write the build script**

Create `packages/core/scripts/build-collectibles-manifest.ts`:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decrypt } from "../src/crypt/index.js";
import { parse } from "../src/gvas/index.js";
import { readEnumArrayEntries } from "../src/gvas/scan.js";
import { normalizeConfidence, prettifyTagPath, deriveFacets, selectCounterTags } from "../src/collectibles.js";
import { COUNTER_MAPPINGS } from "../src/data/collectibles-mapping.js";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const SAVE = here("../test/fixtures/slot0_thirdparty_100pct.sav");
const NAMES = here("../src/data/collectible-names.json");
const OUT = here("../src/data/collectibles.generated.ts");

const body = parse(decrypt(new Uint8Array(readFileSync(SAVE)))).body;
const entries = readEnumArrayEntries(body);
const universe = entries.map((e) => e.tag);
const stateByTag = new Map(entries.map((e) => [e.tag, e.state]));
const names: Record<string, { name: string; confidence: string }> = JSON.parse(readFileSync(NAMES, "utf8"));

/** Most common state among the tags of a category (the "collected" value to write). */
function canonicalState(category: string): string {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.tag.startsWith(`GameProgress.Definitions.${category}.`)) counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  }
  let best = ""; let n = -1;
  for (const [s, c] of counts) if (c > n) { best = s; n = c; }
  if (!best) throw new Error(`No state found for category ${category}`);
  return best;
}

const out = COUNTER_MAPPINGS.map((m) => {
  const tags = selectCounterTags(universe, m);
  if (tags.length !== m.counter) {
    throw new Error(`Counter ${m.key}: selected ${tags.length} tags but expected ${m.counter}`);
  }
  const seen = new Set<string>();
  for (const t of tags) { if (seen.has(t)) throw new Error(`dup tag ${t}`); seen.add(t); }
  return {
    key: m.key, label: m.label, counter: m.counter, verified: m.verified,
    stateValue: canonicalState(m.stateCategory),
    tags: tags.map((t) => ({
      tag: t,
      name: names[t]?.name ?? prettifyTagPath(t),
      confidence: normalizeConfidence(names[t]?.confidence ?? "low"),
      facets: deriveFacets(t),
    })),
  };
});

const banner = "// GENERATED by scripts/build-collectibles-manifest.ts — do not edit by hand.\n";
const file = banner +
  'import type { CollectibleCounter } from "../collectibles.js";\n' +
  `export const COLLECTIBLES: CollectibleCounter[] = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync(OUT, file);
console.log(`Wrote ${out.length} counters, ${out.reduce((a, c) => a + c.tags.length, 0)} tags -> ${OUT}`);
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/collectibles.ts packages/core/scripts/build-collectibles-manifest.ts packages/core/test/collectibles.test.ts
git commit -m "feat(core): selectCounterTags helper + manifest build script"
```

---

## Task 6: Generate and commit the manifest

**Files:**
- Modify: `packages/core/src/data/collectibles.generated.ts` (regenerated)

- [ ] **Step 1: Run the build script**

Run: `cd packages/core && npx --yes tsx scripts/build-collectibles-manifest.ts`
Expected: `Wrote 9 counters, ~670 tags -> .../collectibles.generated.ts` and **no assertion error** (every counter's tag count matches its denominator). If it throws "selected X but expected N", fix the mapping in Task 3/4 until counts match.

- [ ] **Step 2: Typecheck + verify the generated file compiles**

Run: `cd packages/core && npx tsc --noEmit -p .`
Expected: exit 0.

- [ ] **Step 3: Commit the generated manifest**

```bash
git add packages/core/src/data/collectibles.generated.ts
git commit -m "data: generate collectibles manifest (9 counters)"
```

---

## Task 7: CI validation test

**Files:**
- Test: `packages/core/test/collectibles.test.ts`

- [ ] **Step 1: Write the failing CI validation test**

Append to `packages/core/test/collectibles.test.ts`:

```typescript
import { COLLECTIBLES } from "../src/collectibles.js";
import { fx, hasFx } from "./helpers.js";

describe("COLLECTIBLES manifest (committed)", () => {
  it("has counters with tags.length === counter", () => {
    expect(COLLECTIBLES.length).toBeGreaterThanOrEqual(7);
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
      expect(c.stateValue).toMatch(/^E[A-Za-z]+::[A-Za-z]+$/);
      for (const t of c.tags) {
        expect(seen.has(t.tag), `dup ${t.tag}`).toBe(false);
        seen.add(t.tag);
        expect(t.name.length).toBeGreaterThan(0);
        expect(["high", "med", "low"]).toContain(t.confidence);
      }
    }
  });
});

// Local-only: cross-check manifest tags against the 100% save (skips in CI).
describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("manifest vs 100% save", () => {
  it("every manifest tag exists in the 100% save", async () => {
    const { decrypt } = await import("../src/crypt/index.js");
    const { parse } = await import("../src/gvas/index.js");
    const { readEnumArrayEntries } = await import("../src/gvas/scan.js");
    const save = new Set(readEnumArrayEntries(parse(decrypt(fx("slot0_thirdparty_100pct.sav"))).body).map((e) => e.tag));
    for (const c of COLLECTIBLES) for (const t of c.tags) expect(save.has(t.tag), t.tag).toBe(true);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `cd packages/core && npx vitest run`
Expected: PASS (all prior tests + the new manifest tests; the "vs 100% save" block runs locally, skips in CI).

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/collectibles.test.ts
git commit -m "test(core): CI validation for the collectibles manifest"
```

---

## Task 8: Export the public surface + round-trip insert via the manifest

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/collectibles.test.ts`

- [ ] **Step 1: Export from the package index**

In `packages/core/src/index.ts` add:

```typescript
export { COLLECTIBLES, normalizeConfidence, prettifyTagPath, deriveFacets, selectCounterTags } from "./collectibles.js";
export type { CollectibleCounter, CollectibleTag, CollectibleFacets, Confidence } from "./collectibles.js";
```

- [ ] **Step 2: Write the failing round-trip test**

Append to `packages/core/test/collectibles.test.ts`:

```typescript
import { SaveFile } from "../src/sav/index.js";

describe.skipIf(!hasFx("slot0_thirdparty_100pct.sav"))("insert a manifest collectible end-to-end", () => {
  it("inserts a gold brick the save lacks using the manifest's stateValue and count grows", () => {
    // Build a save MISSING one gold brick by starting from the committed minimal fixture's array,
    // then prove insertEnumEntry with the manifest entry adds it.
    const sf = SaveFile.load(fx("slot1_prepatch.sav"));
    const gb = COLLECTIBLES.find((c) => c.key === "GoldBricks")!;
    const have = new Set(sf.enumArrayEntries().map((e) => e.tag));
    const missing = gb.tags.find((t) => !have.has(t.tag))!;
    expect(missing).toBeDefined();
    const templateTag = sf.enumArrayEntries()[0]!.tag; // any existing element as structural template
    const before = sf.enumArrayEntries().length;
    sf.insertEnumEntry({ templateTag, newTag: missing.tag, newState: gb.stateValue });
    const after = sf.enumArrayEntries();
    expect(after.length).toBe(before + 1);
    expect(after.find((e) => e.tag === missing.tag)?.state).toBe(gb.stateValue);
    // round-trips through encrypt/decrypt
    expect(SaveFile.load(sf.toBytes()).enumArrayEntries().some((e) => e.tag === missing.tag)).toBe(true);
  });
});
```

- [ ] **Step 3: Run it; expect PASS** (uses the already-shipped `insertEnumEntry`).

Run: `cd packages/core && npx vitest run test/collectibles.test.ts`

- [ ] **Step 4: Full suite + typecheck**

Run: `cd packages/core && npx vitest run && npx tsc --noEmit -p .`
Expected: all green, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/test/collectibles.test.ts
git commit -m "feat(core): export collectibles manifest; round-trip insert test"
```

---

## Self-review notes

- **Spec coverage:** Stage A → Task 1 (committed name map + derivation docs). Stage B → Tasks 2,5,6 (mapping table, build script, generation). Stage C → Task 7 (CI validation). Open items: Trophies-170 → Task 3; costumes DLC → Task 4. Round-trip test (spec "Testing") → Task 8. Schema/facets → Task 2.
- **Known data-dependent steps:** Tasks 3 & 4 have success *criteria* (counts must equal 170 / 101) rather than fixed outputs, because the exact tag sets are discovered from the save/paks; the build's assert in Task 6 is the hard gate that confirms resolution.
- **Type consistency:** `CollectibleCounter`/`CollectibleTag`/`Confidence`/`selectCounterTags`/`COUNTER_MAPPINGS` names are used identically across Tasks 2,5,6,7,8.
- **Fallback:** every tag always gets a name (`prettifyTagPath`) and confidence (`"low"`) even if absent from the name map, so the build never produces an empty name.
