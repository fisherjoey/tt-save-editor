//! Extract the save keystream from a running game by capturing the decrypted GVAS
//! buffer out of RAM and XOR-ing it against the matching encrypted .sav on disk.

mod mem;

use std::fs;

const MAGIC: &[u8] = b"GVAS";
const BRANCH: &[u8] = b"++Dinner+mainline"; // confirms it's a decrypted save header

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("usage: tt-keystream-capture <encrypted-save.sav> <out-keystream.bin>");
        eprintln!("  Launch the game and LOAD the matching save first, then run this.");
        std::process::exit(2);
    }
    let cipher = match fs::read(&args[1]) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("cannot read save {}: {e}", args[1]);
            std::process::exit(1);
        }
    };

    let pid = match mem::find_game_pid() {
        Some(p) => p,
        None => {
            eprintln!("game process not found — is it running with a save loaded?");
            std::process::exit(1);
        }
    };
    eprintln!("game pid {pid}; scanning for the decrypted save…");

    let regions = mem::writable_regions(pid).unwrap_or_default();
    for r in &regions {
        let buf = match mem::read_region(pid, r) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let mut i = 0;
        while let Some(off) = find(&buf[i..], MAGIC) {
            let pos = i + off;
            // A decrypted save header has the branch string shortly after GVAS.
            let window = &buf[pos..(pos + 64).min(buf.len())];
            if find(window, BRANCH).is_some() {
                if let Some(ks) = derive_keystream(&buf[pos..], &cipher) {
                    fs::write(&args[2], &ks).expect("write keystream");
                    println!("captured keystream: {} bytes -> {}", ks.len(), args[2]);
                    // sanity: known anchor
                    if ks.len() >= 4 && ks[..4] == [0xa5, 0xdf, 0x38, 0xe8] {
                        println!("anchor OK (a5df38e8) — this is the genuine pad");
                    } else {
                        eprintln!("warning: anchor mismatch; double-check the .sav matches the loaded save");
                    }
                    return;
                }
            }
            i = pos + 4;
        }
    }
    eprintln!("no decrypted save buffer found; load a save in-game and try again");
    std::process::exit(1);
}

/// keystream[i] = plaintext[i] XOR ciphertext[i], up to the shorter length.
fn derive_keystream(plain: &[u8], cipher: &[u8]) -> Option<Vec<u8>> {
    let n = plain.len().min(cipher.len());
    if n < 1024 {
        return None;
    }
    Some((0..n).map(|i| plain[i] ^ cipher[i]).collect())
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    hay.windows(needle.len()).position(|w| w == needle)
}
