# NexusMods listing copy (v1.0.0)

## Short description (single line, ≤350 chars)

```
A save editor for LEGO Batman: Legacy of the Dark Knight that runs in your browser. Set studs/playtime, add any collectible (the in-game counters actually move), complete every mission/objective, or fix the "created on an updated version" lockout. Plain-language names for everything, and a summary of exactly what you changed before you download.
```

## Full description (NexusMods sections)

### Description

A save editor for LEGO Batman: Legacy of the Dark Knight that runs entirely in your browser. Drop your save in, do useful things to it — set your studs, set your playtime, add collectibles, complete missions and objectives, or roll the version stamp back so a save from a newer patch loads on an older build — then download it back. No hex-editing, no random executable from a forum thread. The file you drop in never leaves your machine; it's decrypted, edited and re-encrypted right in the page.

Everything reads in plain English: real in-game names for collectibles and objectives (not internal codes), settings shown as Done / Started / Available, and a "Your changes" summary that tells you exactly what you altered before you download. You can undo any edit any time, and back up your original with one click.

**Use it here:** https://tt-save-editor.vercel.app

### Installation instructions

Nothing to install. Open **https://tt-save-editor.vercel.app**, drag your save in, edit, hit download.

Your saves live in:
```
%LOCALAPPDATA%\Warner Bros. Interactive Entertainment\LEGO Batman - Legacy of the Dark Knight\SaveGames\steam\{steamId}\
```
(On Steam Deck / Linux the same folder is inside the game's Proton prefix under `compatdata/<appid>/pfx/...`; Epic uses the same path with an Epic-id subfolder. The editor's "Where do I find my save?" panel has the exact paths.)

Drop `SaveSlot_0_TT.sav` (or whichever slot) into the editor. After downloading, put **both** the new `SaveSlot_X_TT.sav` and its matching `BackupCopy_SaveSlot_X_TT.sav` back into that folder, replacing the originals — the game checks the pair, so you must replace both. **Back up the originals first** (the editor has a one-click "Save a copy of my untouched original").

Prefer to run offline? The `.zip` attached to this mod page is a single self-contained `index.html` — double-click and it opens in your browser, no network required.

Self-host the source: clone https://github.com/fisherjoey/tt-save-editor, `pnpm install && pnpm -C packages/core build && pnpm -C apps/web build`, serve `apps/web/dist`.

### Main features

- **Pick a goal, not a panel.** After your save loads, choose what you're here for: Fix my save · Unlock & complete everything · Fill in what I'm missing · Edit anything. A status bar always shows your save loaded OK, your collectible completion %, a one-click back-up, and Revert all changes.
- **Fix the version lockout.** Sets the build-version stamp back so a pre-patch build accepts the save — the fix for *"This save was created on an updated version of the game."* Type the older build's number, or hand it a save that already works and it reads the number for you.
- **Add collectibles and watch the counters move.** Add gold bricks, Riddler trophies, MicroBuilds, WayneTech chips, vehicles, costumes, stud caches, bat tokens, red bricks and **all 41 challenges** — browse by Category / Mission / District, or "Max out everything." Every item shows its real in-game name with the district decoded (e.g. *Old Gotham South — Red Brick #1*). You can also **remove** anything already in your save (the ✕ next to it).
- **Complete the challenges and actually hit 100%.** Challenges you never reached aren't in the save at all, so older versions couldn't complete them — the editor now adds them, so "Unlock everything" reaches genuine 100%.
- **Every mission & objective in the game** — not just the ones in your save — with objectives nested under their mission. Unnamed entries read as *Objective 2 (part C)* / *Story mission 0-4*, never raw tag paths. Repeated activities (six "Killer Croc — Gotham Village", etc.) are grouped into one expandable row with a **Complete all** button, and each activity's 100%-completion marker folds in as a *"Counts toward 100%"* row.
- **Skip ahead:** "Mark this mission and all earlier story missions done" rebuilds a corrupted playthrough up to a chosen point in one click.
- **Studs, Playtime & WayneTech chips** quick-edits at the top (studs writes the wallet the game actually reads; playtime takes a plain `H:MM:SS`; chips fill up to any number you set).
- **Change the Bat-signal in the sky** without switching chapters — a "Bat-signal style" picker in the Edit view.
- **Every discrete setting** as a friendly dropdown — difficulty, mission/objective state, collectibles, shops, upgrades, characters, and more — with plain-language values. Bulk "set all" with a confirm step on destructive changes.
- **Advanced view** exposing every raw value in the save by name, for anything that isn't a friendly editor (with inline validation and a clear caution).
- **"Your changes"** summary lists everything you altered vs the save you opened, before you download.
- Always writes both `SaveSlot` and `BackupCopy`. The save you drop in never leaves your computer.

### Known limits (as of v1.0.0)

- **Collectible catalogues are validated, in-game counter movement is confirmed for gold bricks.** Every category's tag list is checked against a real 100% save, so the items are correct; gold bricks are additionally confirmed to move their `N/30` in-game. The other categories add by the *identical* mechanism and are marked **not confirmed** in the UI — safe to add (it can't corrupt your save), with reports welcome.
- **Removing items is file-safe but unconfirmed in-game** — it cleanly drops the entry from the save; whether the game then takes the item out of your wardrobe/garage isn't verified yet.
- **The Bat-signal styles are unnamed in the game data** — the picker is a "set a number, load the game, see which look it is" tool (no live previews).
- **Adding missions you haven't reached yet is advanced.** It can confuse the game's story tracking and may skip or lock cutscenes — back up your original first. Editing missions you *have* reached is fine.
- **Curated names cover the story content;** deep side-activity objectives use clean generated labels (*Objective 1 (part B)*) rather than the exact in-game wording.

### Requirements

The game (obviously). Any modern browser. That's it.

### Shout outs

- **@RealDarkCraft** — reverse-engineered the RC4 cipher key out of the game executable and published the save decryptor this editor is built on:
  https://github.com/RealDarkCraft/LEGO-Batman-Legacy-of-the-Dark-Knight---Save-decryptor
- **@ManOfX305**, **@SoggyNoodlez**, **@microchiral** — reported the Studs box was a no-op (which found that the wallet is stored at `Saved_Total`, fixed in v0.1.1).
- **@BlackcatXII** — reported the Batcave-platform edit corrupting neighbouring progress; v0.1.2 ships the container-size tracking that fixes that class of bug.
- **@Ruxxtin** — asked about editing playtime (shipped v0.1.3).
- **@Yoan96111**, **@WiLLUSCUS** — feature requests (Wayne Tech wallet, redo missions); collectible insertion that moves the counters shipped in v0.1.4.
- **@LookAtAiden**, **@GenWashington** — flagged challenges never completing to 100%; challenge insertion shipped in v1.0.0 (plus item removal for @GenWashington).
- **@jazzdestructor**, **@hb12345** — asked for a WayneTech-chip quick edit by the Studs box; shipped v1.0.0.
- **@SkeletorWaluigi** — "edit everything" miscategorised collectibles; regrouped by real category in v1.0.0.
- **@jiggy2g** — wanted to change the Bat-signal look; Bat-signal picker shipped in v1.0.0.

### Links

- Editor: https://tt-save-editor.vercel.app
- Source (MIT): https://github.com/fisherjoey/tt-save-editor
- Latest release: https://github.com/fisherjoey/tt-save-editor/releases/tag/v1.0.0
