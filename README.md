# TT Save Editor

A save editor for LEGO Batman: Legacy of the Dark Knight that runs in your browser. Drop in a `.sav`, edit what you want, download it. Decrypt, edit, and re-encrypt all happen on your machine.

Live: https://tt-save-editor.vercel.app · Current release: **v0.1.1**

## What it can do

Drag in `SaveSlot_0_TT.sav` and the editor decrypts it. Top of the page has a Studs box where you can just type a number, and a "Complete everything" button that marks every collectible, challenge, mission, and objective done in one click.

There's also a downgrade form. It sets the build version stamp back so a pre-patch build will load the save, which is what you want if an update broke a speedrun route and the game keeps refusing with *"This save was created on an updated version."*. Type the build number directly, or load a save made on the older build and the editor reads it for you.

Below that, dropdowns for the discrete settings — difficulty, mission state, collectible state, objectives, save validation, install state, etc. Each entry shows the gameplay tag next to it (`Tutorials.Basic.Move`, `LeavingAreaSplines.Tricorner`, that sort of thing) so when an enum appears 8 times you can actually tell them apart. An Advanced section underneath exposes every value in the save by name.

The download gives you both `SaveSlot_X_TT.sav` and its matching `BackupCopy_SaveSlot_X_TT.sav`. The game checks the pair, so the tool writes both.

## Known limitation (will be lifted in v0.1.2)

Right now, enum dropdowns only show options whose byte length matches the current value. So `Unlocked → Rewarded` (both 8 chars) works fine, but `Locked → Collected` (6 vs 9) is blocked. This is a temporary safety against a save-corruption bug: changing an enum to a different byte length shifts subsequent bytes, but the containing Array/Map's outer `Size` field stays stale, which causes the game to misread the rest of that section and reset neighbouring state.

Fixing this properly means parsing UE 5.6's `StructProperty` tag format (with `TopLevelAssetPath`) well enough to walk the body recursively and find every container's `Size` field, then update them all when an edit changes byte length. That's the v0.1.2 work. See [`docs/v0.1.2-research-brief.md`](docs/v0.1.2-research-brief.md) for the open question, the bytes we've decoded so far, and what's still needed.

## Credit

The save cipher (RC4 with a 32-byte key compiled into the game executable) was pulled out of the binary by [@RealDarkCraft](https://github.com/RealDarkCraft/LEGO-Batman-Legacy-of-the-Dark-Knight---Save-decryptor). The editor is built on top of that.

## Safety

This thing edits your save, so the obvious failure mode is corrupting it. The design takes that seriously.

The body of the save is preserved byte for byte. Only the bytes you change get touched. Load a save, do nothing, download it, and you get the same file back. That's verified in the test suite against real saves up to a 1.5 MB 100% completion file. On load the editor also runs a round-trip self-check, and if it can't reproduce the input exactly, it refuses to hand you anything. Originals are never written in place either; the result is always a download.

Even so, keep a copy of your original before replacing it. Software is software.

## How it works

Saves are RC4-encrypted with a fixed 32-byte key baked into the game. The same key works for every copy, which is what makes this fully client-side. Under the encryption is standard UE5 GVAS (engine branch `++Dinner+mainline`). The editor parses the header, locates editable scalar and enum fields by name (never by fixed offset, since offsets shift between saves), and rewrites only the bytes you change.

For currency / wallet fields like Studs, the game stores the value in multiple denormalized places (`StudsCollected` plus two `Saved_Total` fields). Updating one and not the others = the game ignores your edit. The editor writes them in sync.

## Repo

```
packages/core    @tt-save/core — decrypt / parse / scan / edit / re-encrypt. No UI, no network.
apps/web         React + Vite SPA (the editor itself).
docs/            design specs and the v0.1.2 research brief.
```

## Develop

```bash
pnpm install
pnpm -C packages/core test     # the safety net. Run this.
pnpm -C apps/web dev           # http://localhost:5173
```

## Contributing

The Studs box and the friendly enum titles live in data files: `packages/core/src/featured.ts` and `packages/core/src/enums.ts`. To map a new field: change it in-game, re-save, diff, add an entry. PRs welcome.

If you have UE GVAS expertise and want to take a swing at the container-size tracking for v0.1.2, see [`docs/v0.1.2-research-brief.md`](docs/v0.1.2-research-brief.md).

## Legal

Edits your own save files for your own copy of the game (interoperability, personal use). Not affiliated with, endorsed by, or connected to Warner Bros. or TT Games. MIT licensed.

---

*Keywords: LEGO Batman Legacy of the Dark Knight save editor, save downgrade, version downgrade, "created on an updated version" fix, GVAS editor, TtSave, speedrun practice.*
