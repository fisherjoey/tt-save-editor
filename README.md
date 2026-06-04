# TT Save Editor

A free, in-browser save editor for **LEGO Batman: Legacy of the Dark Knight**.

Edit any field in your save, or make a save load on an **older patch** of the game (handy for speedrun practice when an update removes a route). Everything runs locally in your browser — your save file is never uploaded anywhere.

> **Web app:** https://tt-save-editor.vercel.app · **Status:** early but the core is well-tested and safe.

## What it does

- **Open a `.sav`** — drag in `SaveSlot_0_TT.sav` and the editor decrypts it in your browser.
- **Edit any field** — studs, counters, flags, names, and every other value the save stores, found and listed by name.
- **Downgrade to an older patch** — set the save's build version back so a pre-patch build will load it. The game otherwise refuses with *"This save was created on an updated version."*
- **Download** the patched `SaveSlot` and its matching `BackupCopy` (the game checks the pair).

## Why this is safe

Corrupting a save would be the worst thing this tool could do, so safety is the whole design:

- The save's body is kept **byte-for-byte** and only the exact bytes you change are touched. Opening and re-saving without edits produces an **identical file** — verified in the test suite against real saves up to a 1.5 MB 100%-completion save.
- On load, the editor runs a round-trip self-check and **refuses to emit a file it can't reproduce**.
- Originals are never modified in place — you always get a download.

Still: keep a backup of your save before replacing it.

## How the saves work (the short version)

The game (Unreal Engine 5.6, internal project "Dinner", `TtSaveSystem`) obfuscates saves by XOR-ing the data against a **fixed keystream that's the same in every copy of the game**. Underneath is a standard UE **GVAS** save. Because the keystream is constant, one captured pad decrypts and re-encrypts anyone's save — which is why this works as a zero-install web app with no game running.

The version check that blocks cross-patch loads is a `BuildVersion` field stored in the save; the downgrade simply sets it to the target build's value.

## Keystream

The editor ships with a bundled keystream that covers the start of every save (enough for the version downgrade on any file). For editing fields deep inside very large saves, a longer keystream is needed — see [`tools/capture`](tools/capture) to extract one from your own running game (the keystream is identical for everyone, so this is rarely necessary).

## Repo layout

```
packages/core   @tt-save/core — decrypt / parse / scan / edit / re-encrypt (no UI, no network)
apps/web        React + Vite single-page app (the editor UI)
tools/capture   keystream extractor (reads the pad from a running game)
```

## Develop

```bash
pnpm install
pnpm -C packages/core test     # the safety net — run this
pnpm -C apps/web dev           # http://localhost:5173
```

## Contributing

The generic field editor already covers everything by name. "Curated" editors (a labelled *Studs* box, *unlock all characters*, etc.) are data-driven recipes — see [`packages/core/src/recipes`](packages/core/src/recipes). Mapping a field is usually as simple as: change it in-game, re-save, diff, and add a recipe. PRs welcome.

## Legal

This edits **your own save files** for your own copy of the game — interoperability and personal use. It ships a reverse-engineered XOR keystream (the same thing every save editor needs) and **no copyrighted game assets**. Not affiliated with, endorsed by, or connected to Warner Bros. or TT Games. MIT licensed.

---

_Keywords: LEGO Batman Legacy of the Dark Knight save editor, save downgrade, version downgrade, "created on an updated version" fix, GVAS editor, TtSave, speedrun practice._
