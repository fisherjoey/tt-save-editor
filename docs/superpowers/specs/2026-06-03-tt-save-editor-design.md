# TT Save Editor — Design

**Date:** 2026-06-03
**Status:** Approved

A zero-install, open-source web editor for **LEGO Batman: Legacy of the Dark Knight** save files (UE5.6 "Dinner" engine, `/Script/TtSaveSystem.TtSaveGame`). Edit any field in a save, or one-click "downgrade" a save so a newer-patch save loads on an older build (the speedrun-practice use case).

## Why it works

Saves are obfuscated with a **byte-wise XOR against a fixed keystream that is identical for every copy of the game** (verified: our captured pad decrypts a random third-party NexusMods save to clean GVAS). So one captured pad ("the pad") decrypts/encrypts anyone's save — pure offline XOR, no key derivation, no game running. Underneath is standard UE **GVAS** (engine branch `++Dinner+mainline`).

## Keystream model — Hybrid

- **Bundled pad:** ship the captured keystream (compressed asset). Covers saves up to its length (target: a 100%-save-length pad, ~1.5 MB).
- **Self-capture fallback:** a native utility extracts the pad from the user's own running game (Win `ReadProcessMemory` / Linux `/proc/pid/mem` / macOS) for saves longer than the bundled pad or after a game update changes the pad.

## Architecture — TS monorepo (pnpm), client-side, deployed on Vercel

```
packages/core/   @tt-save/core  (no UI deps; unit-tested in isolation)
  crypt/   XOR decrypt/encrypt + keystream provider (bundled pad | imported pad)
  gvas/    GVAS parser <-> serializer (BYTE-IDENTICAL round-trip), typed property tree
  sav/     high-level: load .sav -> edit -> write .sav + BackupCopy (kept in sync)
  recipes/ data-driven curated actions (downgrade, rename, studs, ...)
apps/web/        @tt-save/web   React + Vite SPA -> Vercel (save never leaves browser)
tools/capture/   Rust cross-platform keystream extractor -> pad file the web app imports
assets/          keystream.bin.gz (bundled pad)
```

## Components

- **crypt** — pure XOR; length-aware keystream provider. Sources: bundled gz pad or imported pad. Anchor: `ks[0:4] == a5 df 38 e8`.
- **gvas** — parse decrypted GVAS into a typed tree (Int/UInt32/Int64/Str/Name/Bool/Struct/Array/Enum/...); serialize back **byte-identical**. The hard correctness requirement.
- **sav** — orchestrates decrypt→parse→edit→serialize→encrypt; regenerates `BackupCopy_*` to match (game cross-checks the pair).
- **recipes** — JSON-defined actions over the parsed tree. **Locate fields by property NAME, never fixed offset** (layouts shift per save). v1: `downgrade` (set `BuildVersion` + header `Changelist` to a target value), `rename-slot`. Grows via community PRs.
- **web UI** — drag-drop `.sav`; generic property-tree editor (edit anything) + curated panels; download patched `.sav` + `BackupCopy` + placement instructions.
- **capture (Rust)** — scans the running game's heap for the decrypted GVAS during a load; emits a pad file. Cross-platform.

## Data flow

`drop .sav -> decrypt(pad) -> gvas.parse -> edit (tree | recipe) -> gvas.serialize -> encrypt(pad) -> download SaveSlot + BackupCopy`

## Safety (primary concern — corruption = ruined progress)

- **Round-trip guard:** a no-op edit MUST produce byte-identical output. Enforced in tests AND at runtime — if a save can't round-trip, the app refuses to emit a download.
- **Keystream-length guard:** edits beyond pad coverage are blocked / prompt self-capture. Header/version edits are always in range.
- **Never in-place:** output is a download; originals untouched. `BackupCopy` regenerated to match `SaveSlot`.

## Testing (the backbone — TDD, real saves as fixtures)

Fixtures = real captured saves (`slot0_patched`, `slot1_prepatch`, `slot0_thirdparty_100pct`) + the keystream, committed.
- **Tier 1 Round-trip/golden (non-negotiable):** `encrypt(decrypt(f))==f`; `serialize(parse(d))==d` (byte-identical GVAS); `save(load(f))==f`. If any real fixture fails, do not ship.
- **Tier 2 Edit correctness:** single-field edit changes only expected bytes; `downgrade` sets `BuildVersion`+`Changelist`, else identical.
- **Tier 3 Fuzz:** random valid edits round-trip & re-parse to same tree; malformed input fails gracefully (never silent garbage).
- **Tier 4 Crypt anchors:** `ks[0:4]`, XOR involution.
- **Tier 5 Real-game acceptance (ultimate gate):** a tool-edited save actually loads in the game (manual checklist, Joey's machine). No recipe is "working" until the game loads it.
- **Tier 6 Capture:** pad reproduces `ks[0:4]` + decrypts fixtures; Linux integration on Joey's box; Windows logic unit-tested vs synthetic process.
- **CI:** GitHub Actions runs Tiers 1–4 + fuzz per PR; Vercel preview per PR; Playwright e2e (drop fixture → downgrade → bytes == golden).

## v1 scope

Core lib complete; generic property-tree editor ("edit anything") complete; recipes = downgrade + rename + any quickly-mapped fields (studs via save-diffing); bundled long pad (prereq: capture full pad from a large save); self-capture utility (Linux+Windows); Vercel deploy; README + MIT + legal disclaimer (your own saves; no game assets shipped, only a keystream); recipe-contribution guide. Post-v1: curated editors grow as fields are mapped.

## Legal

Edits the user's own saves (interoperability/personal use). Ships a reverse-engineered XOR keystream (standard for save editors), no copyrighted game assets. MIT. Not affiliated with WB/TT Games.
```
