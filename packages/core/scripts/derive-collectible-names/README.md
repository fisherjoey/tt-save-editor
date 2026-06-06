# Collectible names derivation (maintainer-only, not CI)

Regenerates `src/data/collectible-names.json` (the tag → display-name map) from the
game's UE5 paks. Run by hand after a game patch; CI and `pnpm build` never run this —
they consume the committed JSON.

## Prereqs (local only)
- `cargo install --git https://github.com/trumank/repak repak_cli`
- `cargo install --git https://github.com/trumank/retoc`
- Game paks: `<install>/LEGOBatmanLotDK/Content/Paks` — UE5.6 IoStore, **no AES**, Oodle
  auto-handled by retoc on Linux.
- The 100% save fixture (for the authoritative target tag list + counts).

## Procedure
1. Dump the target tag universe grouped by category from the 100% save
   (`readEnumArrayEntries`), e.g. to `/tmp/ttx_targets.json`.
2. Extract name-bearing assets (the asset PATHS carry the names):
   `retoc to-legacy --version UE5_6 --no-shaders --filter <substr> "<PaksDir>" /tmp/out`
   - Story collectibles: `--filter GameProgress` → `Content/GameProgress/Story/Chapter_CC/PROG_CC_MM_<MissionName>.uasset`; map tag `Story.CC.MM` → that mission name.
   - Hub collectibles: district codes resolve via the `DISTRICTS` map in
     `src/data/collectibles-mapping.ts` (sourced from the game's `UI_HUB_DISTRICT` string table).
   - Entities (Characters/Vehicles/ShopItems/Skills/Gadgets): names are in the tag segments; prettify.
   - Activities / long tail: tag-derived + district.
3. Merge into `{ "<tag>": { "name", "confidence": "high|med|low", "source" } }` and write
   `src/data/collectible-names.json`.

## Notes
- tmpfs `/tmp` is RAM-backed; a full `--filter Character` extraction can fill it (ENOSPC).
  Use tight filters and clean up `/tmp/out` dirs between passes.
- The `*.py` files here are the per-group derivation scripts from the original extraction
  (entity + misc groups), kept for reference.
