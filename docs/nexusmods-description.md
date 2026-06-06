# NexusMods listing copy (v0.1.2)

## Short description (single line, ≤350 chars)

```
A save editor for LEGO Batman: Legacy of the Dark Knight that runs in your browser. Set studs, complete every collectible/challenge/mission/objective in one click, or downgrade a save so it loads on a pre-patch build (fixes "This save was created on an updated version"). Raw field view for everything else.
```

## Full description (NexusMods sections)

### Description

A save editor for LEGO Batman: Legacy of the Dark Knight that runs entirely in your browser. The whole point is to let you do useful things to your save — set your stud total, flip every collectible/challenge/mission/objective to done, fix the version stamp so a save from a newer patch loads on an older build — without hex-editing or trusting some random executable from a forum thread. The file you drop in never leaves your machine.

**Use it here:** https://tt-save-editor.vercel.app

### Installation instructions

Nothing to install. Open **https://tt-save-editor.vercel.app** in your browser, drag your save in, edit, hit download.

Your saves live in:
```
%LOCALAPPDATA%\Warner Bros. Interactive Entertainment\LEGO Batman - Legacy of the Dark Knight\SaveGames\steam\{steamId}\
```

Drop `SaveSlot_0_TT.sav` (or whichever slot you want) into the editor. After downloading the result, drop both the new `SaveSlot_X_TT.sav` and its matching `BackupCopy_SaveSlot_X_TT.sav` back into that folder, replacing the originals. Back up the originals first.

Prefer to run offline? The `.zip` attached to this mod page is a single self-contained `index.html` — double-click and it opens in your default browser, no network required.

Self-host the source: clone https://github.com/fisherjoey/tt-save-editor, `pnpm install && pnpm -C packages/core build && pnpm -C apps/web build`, serve `apps/web/dist`.

### Main features

- Studs: a labelled number box at the top. Type your new total, download. (Writes both `StudsCollected` and the two `Saved_Total` fields the game actually reads from.)
- "Complete everything" button: one click marks every collectible, challenge, mission, and objective done.
- Downgrade: sets the build version stamp back so a pre-patch build will accept the save. Type the older build's number directly, or load a reference save made on that build and the editor reads it for you. This is the fix for the *"This save was created on an updated version"* lockout.
- Dropdowns for every discrete setting (difficulty, mission state, collectibles, objectives, save validation, install state, and so on). Each entry is labelled with the gameplay tag that identifies it, so when an enum appears 8 times you can tell which is which.
- Advanced view exposing every value in the save by name, for the stuff that isn't a friendly editor.
- Always writes both `SaveSlot` and `BackupCopy`. The game checks the pair, so the tool writes both.
- The save you drop in never leaves your computer.

### Known limits (as of v0.1.2)

- **In-game collectible counters don't move when you edit existing entries.** The displayed "3/30 gold bricks" comes from how many gold-brick entries exist in your save, not what state they're in. So flipping `Locked → Collected` updates the file correctly but the count stays put. Adding new entries (the "+1 gold brick" operation) is on the roadmap for v0.1.3.
- **Mapping for Wayne Tech chips, playtime, and similar denormalized fields is still pending.** The Studs box works because we mapped that one; the others need the same treatment.

### Requirements

The game (obviously). Any modern browser. That's it.

### Shout outs

- **@RealDarkCraft** — reverse-engineered the RC4 cipher key out of the game executable and published a save decryptor that this editor is built on top of:
  https://github.com/RealDarkCraft/LEGO-Batman-Legacy-of-the-Dark-Knight---Save-decryptor

- **@ManOfX305**, **@SoggyNoodlez**, **@microchiral** — reported the Studs box was a no-op (which led to finding that the game's wallet is stored at `Saved_Total`, not `StudsCollected`, and rolling out the fix in v0.1.1).

- **@BlackcatXII** — reported the Batcave-platform edit corrupting neighbouring progress. v0.1.2 ships the parent-container-size tracking that fixes that class of bug.

- **@Yoan96111**, **@Ruxxtin**, **@WiLLUSCUS** — feature requests (Wayne Tech chips, playtime, redo missions) tracked for v0.1.3.

### Links

- Editor: https://tt-save-editor.vercel.app
- Source (MIT): https://github.com/fisherjoey/tt-save-editor
- Latest release: https://github.com/fisherjoey/tt-save-editor/releases/tag/v0.1.2
