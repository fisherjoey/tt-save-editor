# Collectibles manifest pipeline — design (spec #1)

**Date:** 2026-06-06
**Branch:** `feat/collectible-array-insertion`
**Status:** proposed — awaiting review

## Purpose

The v0.1.4 insertion mechanism (`insertEnumEntry`, shipped in `packages/core/src/gvas/scan.ts`) can add a collectible entry to the save's single `SavedGameProgressEnumValues` array, which moves the in-game counter (verified: gold bricks 3/30 → 4/30 in-game). To expose this in the UI as "add a gold brick" / "max out minikits", the tool needs a **bundled, validated catalogue** of every valid collectible: its gameplay tag, a human display name, which in-game counter it belongs to, and the enum state to write.

This spec defines the **pipeline that produces that catalogue** (the "collectibles manifest") and commits it as data the UI consumes. The panel UI itself is spec #2.

## What already exists (inputs)

1. **Tag universe + counts + canonical state** — the 100% save fixture `packages/core/test/fixtures/slot0_thirdparty_100pct.sav` (gitignored, local only). `readEnumArrayEntries(body)` yields every entry's `{tag, state}`. A category's tag count equals the in-game `/N` denominator (gold bricks: 30 tags = /30). This is the authority for *which tags are valid* and *what state a "collected" entry carries*.
2. **Display names** — derived from the game's UE5 paks via `retoc` (extraction proven; UE5.6 IoStore, no AES, Oodle auto-handled on Linux). Already produced and persisted at `~/.local/share/tt-save-editor/collectible-names/collectible-names.merged.json`: 3,340 collectible tags → `{name, confidence, source}`, plus the per-group fragments and derivation scripts. Story names come from `PROG_CC_MM_<Mission>` asset paths; hub names from the district map; entity names from tag segments.
3. **District map & counter→category mappings** — resolved during extraction (recorded in the project memory and the agent outputs).

## Architecture — three stages

```
[100% save] ──readEnumArrayEntries──┐
                                     ├──► build-manifest.ts ──► collectibles.ts (committed)
[name map JSON] ─────────────────────┘            │
[counter-mapping table (in script)] ──────────────┘
                                                   │
                              CI test validates the committed artifact
```

### Stage A — names derivation (maintainer tool, not CI)

The expensive, environment-dependent step (needs the paks + `retoc`). **Already executed**; its output (the merged name map) is the committed input to Stage B. We fold the procedure into a committed, documented script `packages/core/scripts/derive-collectible-names/` (the cleaned-up `retoc` extraction + the four naming methods: story-mission, hub-district, entity-from-tag, activities) so it is **reproducible after a game patch**, but it is **never run in CI** (CI has no paks). The merged name map is committed to the repo as `packages/core/src/data/collectible-names.json` so Stage B is self-contained.

Documented external dependencies (for the maintainer): `retoc`/`repak` (`cargo install --git https://github.com/trumank/{repak,retoc}`); the game paks; the 100% save fixture. Working command pattern: `retoc to-legacy --version UE5_6 --no-shaders --filter <substr> <PaksDir> <out>`.

### Stage B — `build-manifest.ts` (maintainer tool, needs the 100% save)

`packages/core/scripts/build-collectibles-manifest.ts`. Steps:
1. Load the 100% save → group entries by category (3rd tag segment after `GameProgress.Definitions.`), capturing each category's tag list, count, and the canonical "collected" state (the most common non-locked member observed for that category).
2. Load the committed name map → name + confidence per tag. Missing name → fall back to a prettified tag path (so every tag always has *some* name).
3. Apply the **counter-mapping table** (hand-authored in the script): which tag-categories compose each in-game counter, the `/N` denominator, the `verified` flag, and the label/icon.
4. Normalise confidence labels (`medium` → `med`).
5. Emit `packages/core/src/data/collectibles.ts` — a typed `export const COLLECTIBLES`.
6. **Assert** (fail the build on violation): for each counter, `sum(tags) === counter` denominator; no duplicate tags; every tag has a name; every category has a well-formed `stateValue`.

### Stage C — CI test `packages/core/test/collectibles-manifest.test.ts`

Runs in CI against the **committed** manifest only (no paks/100%-save needed):
- Each counter's `tags.length === counter`.
- No duplicate tags across the whole manifest.
- Every tag has a non-empty name and valid `confidence`.
- Every category's `stateValue` matches `^E[A-Za-z]+::[A-Za-z]+$`.
- `verified` is `true` only for gold bricks.

When the 100% fixture *is* present locally, an additional (auto-skipped in CI) test asserts the manifest's tags per category exactly equal the save's tags.

## Manifest schema (committed artifact)

```ts
export type Confidence = "high" | "med" | "low";

export interface CollectibleTag {
  tag: string;          // full gameplay tag (insertEnumEntry newTag)
  name: string;         // display name, or prettified-path fallback
  confidence: Confidence;
  facets: {             // drive the panel's "View by" switcher
    source: "story" | "hub" | "shop" | "other";
    chapter?: number;   // story
    mission?: number;   // story
    island?: string;    // hub  (e.g. "Tri-Corner")
    district?: string;  // hub  (e.g. "Old Gotham North")
  };
}

export interface CollectibleCounter {
  key: string;          // "GoldBricks"
  label: string;        // "Gold bricks"
  counter: number;      // in-game /N denominator (== tags.length)
  verified: boolean;    // true only where confirmed in-game (gold bricks)
  stateValue: string;   // enum to write on insert, e.g. "ETtCollectableGameProgressState::Collected"
  tags: CollectibleTag[];
}

export const COLLECTIBLES: CollectibleCounter[];
```

`facets` is what lets the panel slice "by Category / by Source / by District / by Chapter" without re-parsing tags at runtime.

## Counter → category mapping (hand-authored, validated by Stage B asserts)

| In-game counter | Tag category(ies) | /N | verified | Notes |
|---|---|---|---|---|
| Gold bricks | `GoldBricks` | 30 | **yes** | proven in-game |
| Red bricks | `RedBricks` | 23 | no | |
| Minikits | `RiddlerTrophies` | 121 | no | count matches exactly |
| Wayne Tech chips | `WayneTechChips` | 200 | no | |
| Vehicles | `ShopItems.Vehicles.*` | 30 | no | 3 extra `Vehicles.*` are DLC Batmobiles → excluded |
| Costumes | `Characters` (base) | 101 | no | 125 total − ~24 DLC/promo; **DLC split to finalise in impl** |
| Stud caches | `StudCaches` | 100 | no | |
| Bat tokens | `BatTokens` | 65 | no | |
| Trophies | **UNRESOLVED** | 170 | no | candidates: `MicroBuilds`(125)+`BatcaveTrophy`(24)+… — reconcile to 170 in impl |

Categories outside this table (e.g. `Activities`, `Tutorials`, `Conversations`, and the 895 `Story.*` progression flags) are **not** collectibles for the panel and are excluded from the manifest. (`Story.*` flags are edited by the existing EnumPanel.)

## Open items to resolve during implementation

1. **Trophies (170)** counter composition — find the exact set of tag-categories summing to 170; Stage B assert will fail loudly until correct.
2. **Costumes DLC split** — enumerate which `Characters.*` tags are DLC (assets under `AdditionalContent/DLC_*`) so the base count is exactly 101.
3. Decide manifest output format: `collectibles.ts` (typed const, matches `featured.ts`/`enums.ts`; **recommended**) vs `.json` (needs import config). Spec assumes `.ts`.
4. Whether to keep the full 3,340-tag map or only the counter categories in the committed manifest (recommend: only counter categories, to keep the bundle small; ~600 tags).

## Testing

- Stage C CI test (above) — the safety net that runs everywhere.
- Stage B's build-time asserts — catch mapping errors at generation.
- A round-trip test (extends `insert.test.ts`): pick a manifest tag absent from a fixture, `insertEnumEntry` it with the manifest's `stateValue`, reparse, assert present + count grew + neighbours intact.

## Out of scope

- The Collectibles panel UI (→ spec #2).
- Editing existing progression/state enums (existing EnumPanel).
- The insertion byte-mechanism (already shipped this branch).
- Per-collectible *location* blurbs beyond mission/district granularity (would need deeper pak/`.locres` mining; current names are mission/district-level, which is sufficient).

## Reproducibility summary

CI and normal `pnpm build` consume only committed artifacts (the manifest + name-map JSON) — no paks, no 100% save. The two maintainer scripts (Stage A names derivation, Stage B manifest build) regenerate those artifacts from local-only inputs and are run by hand after a game patch, then the regenerated artifacts are committed.
