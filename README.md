# TT Save Editor

A free, in-browser save editor for **LEGO Batman: Legacy of the Dark Knight**.

Edit any field in your save, or make a save load on an **older patch** of the game (handy for speedrun practice when an update removes a route). Everything runs locally in your browser — your save file is never uploaded anywhere.

> **Status:** early but well-tested. Deploy your own in one click by importing this repo on [Vercel](https://vercel.com/new) (it reads `vercel.json` automatically) — or run it locally (below).

## What it does

- **Open a `.sav`** — drag in `SaveSlot_0_TT.sav` and the editor decrypts it in your browser.
- **🏆 Complete everything** — one click marks all collectibles, challenges, missions, and objectives done.
- **Studs box** — change your total studs as a labelled input, no hunting required.
- **Make a save load on an older patch** — sets the build-version stamp back so a pre-patch build will load it. The game otherwise refuses with *"This save was created on an updated version."*
- **Progress & settings dropdowns** — friendly grouped panels for difficulty, mission state, collectible state, objectives, save validation, install state, etc. Each entry is labelled with the gameplay tag that identifies it.
- **Advanced: all raw fields** — every value in the save, by name, for power users.
- **Download** the patched `SaveSlot` and matching `BackupCopy` (the game checks the pair).

## Credit

The save cipher — RC4 with a 32-byte key reverse-engineered out of the game executable — is from [**@RealDarkCraft**'s save-decryptor](https://github.com/RealDarkCraft/LEGO-Batman-Legacy-of-the-Dark-Knight---Save-decryptor). Big thanks; the editor is built on top of that discovery.

## Safety

Corrupting a save is the worst thing this tool could do, so safety is the design:

- The save's body is kept **byte-for-byte** and only the exact bytes you change are touched. Opening and re-saving without edits produces an **identical file** — verified in the test suite against real saves up to a 1.5 MB 100%-completion save.
- On load, the editor runs a round-trip self-check and **refuses to emit a file it can't reproduce**.
- Originals are never modified in place — you always get a download.

Still: keep a backup of your save before replacing it.

## How it works under the hood

Saves are **RC4-encrypted** with a fixed 32-byte key baked into the game (same in every copy — so one cipher works for everyone, fully client-side). Under the encryption it's standard UE5 **GVAS** (engine branch `++Dinner+mainline`). The editor parses the header, locates editable scalar and enum fields by name (never by fixed offset, which would break across saves), and rewrites only the bytes you change.

## Repo layout

```
packages/core    @tt-save/core — decrypt / parse / scan / edit / re-encrypt (no UI, no network)
apps/web         React + Vite single-page app (the editor UI)
```

## Develop

```bash
pnpm install
pnpm -C packages/core test     # the safety net — run this
pnpm -C apps/web dev           # http://localhost:5173
```

## Contributing

Curated "Quick edits" (Studs etc.) and grouped enum titles are data-driven — see `packages/core/src/featured.ts` and `packages/core/src/enums.ts`. Mapping a new field is usually as simple as: change it in-game, re-save, diff, and add an entry. PRs welcome.

## Legal

This edits **your own save files** for your own copy of the game — interoperability and personal use. Not affiliated with, endorsed by, or connected to Warner Bros. or TT Games. MIT licensed.

---

*Keywords: LEGO Batman Legacy of the Dark Knight save editor, save downgrade, version downgrade, "created on an updated version" fix, GVAS editor, TtSave, speedrun practice.*
