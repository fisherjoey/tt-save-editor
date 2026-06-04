# tt-keystream-capture

Extracts the save **keystream** ("the pad") from your own running copy of
*LEGO Batman: Legacy of the Dark Knight*. You normally don't need this — the web
editor ships a bundled pad that's identical for every copy of the game. It's only
useful for editing fields deep inside very large saves (longer than the bundled
pad) or if a game update ever changes the pad.

## How it works

The game decrypts a save into memory when it loads one. This tool scans the
running game's memory for that decrypted GVAS buffer, then XORs it against the
matching encrypted `.sav` file on disk. The result is the keystream, which the
web editor can import.

## Usage (Linux)

```bash
# 1. Launch the game and LOAD a save (so the decrypted buffer is in RAM).
# 2. Run, pointing at the encrypted file you just loaded:
cargo run --release -- /path/to/SaveSlot_0_TT.sav keystream.bin
```

Reading another process's memory needs permission: either run as the same user
with `ptrace_scope` relaxed, or with `sudo`.

## Windows / macOS

The memory-reading backend is isolated in `mem.rs`. Linux (`/proc/<pid>/mem`) is
implemented. Windows (`ReadProcessMemory`) and macOS (`mach_vm_read`) are the
follow-up backends — contributions welcome.
