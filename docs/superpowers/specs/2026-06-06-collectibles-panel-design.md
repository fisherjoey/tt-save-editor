# Collectibles panel — design (spec #2)

**Date:** 2026-06-06 · **Branch:** `feat/collectible-array-insertion` · **Status:** approved (brainstormed) — building

## Purpose
Expose the v0.1.4 insertion mechanism + the committed `COLLECTIBLES` manifest as a UI panel so users can add collectibles (move in-game counters) without touching tags. Chosen shape (brainstorm): **one panel + facet switcher** — max-out *and* granular, sliceable by facet.

## Component
`apps/web/src/components/CollectiblesPanel.tsx`, rendered in `App.tsx` after `EnumPanel`.

**Props**
- `collectibles: CollectibleCounter[]` (the committed manifest).
- `present: Set<string>` (tags currently in the save).
- `onAdd: (items: { tag: string; stateValue: string }[]) => void` (App groups by state → `SaveFile.addCollectibles`).

**Layout**
- Heading "Collectibles" + hint: names come from the game's data; categories badged **✓ verified** (gold bricks) or **untested**.
- Toolbar: `View by: [Category | Source]` toggle · search box (filters by name/tag) · `Max out everything` button.
- **Category view (default):** one collapsible group per counter — header shows `label`, `have/counter`, verified/untested badge, and a `Max out` button (queues all missing in that group). Body lists tags: present = checked + disabled; missing = checkable. A sticky `Add selected (N)` applies the current selection.
- **Source view:** the same tags regrouped by `facets.source` (Story / Hub / Shop / Other), with a sub-line of district/chapter where present. Same checkbox + max-out affordances per group.

**Behaviour**
- Selection is a `Set<string>` of missing tags. `Max out` (group) and `Max out everything` resolve to a selection then call `onAdd` immediately; `Add selected` applies the manual selection.
- Each tag carries its counter's `stateValue` (built into a flat tag→{counter,stateValue,name,confidence,facets} index once).
- After add, `App` refreshes (`refreshFields`) so `present`/counts update.
- Large groups (200 Wayne Tech chips) are virtualization-free but capped in the DOM with a "showing first N — use search" note, mirroring `EnumPanel`.

## Out of scope
- Per-collectible in-world location text beyond the manifest names.
- The base/DLC costume split (manifest counter = all 125 Characters).

## Testing
- Core already covers insertion + `addCollectibles`. UI: a Vitest + Testing Library smoke test that the panel renders counters from a stub manifest, toggles views, and fires `onAdd` with the right `{tag,stateValue}` on "Max out". Plus a manual `pnpm build` + load check before deploy.
