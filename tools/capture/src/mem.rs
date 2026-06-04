//! Platform-specific process memory access. Linux is implemented; Windows/macOS
//! are the follow-up backends (see README).

#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "linux")]
mod linux {
    use std::fs;
    use std::io::{Read, Seek, SeekFrom};

    /// Find the running game process. Matches the main GameThread of the shipping exe.
    pub fn find_game_pid() -> Option<i32> {
        for entry in fs::read_dir("/proc").ok()? {
            let entry = entry.ok()?;
            let name = entry.file_name();
            let pid: i32 = match name.to_str().and_then(|s| s.parse().ok()) {
                Some(p) => p,
                None => continue,
            };
            let cmd = fs::read(format!("/proc/{pid}/cmdline")).unwrap_or_default();
            let comm = fs::read_to_string(format!("/proc/{pid}/comm")).unwrap_or_default();
            // The shipping process renames its main thread to "GameThread".
            if comm.trim() == "GameThread"
                && cmd.windows(b"LEGOBatmanLotDK-Win64-Shipping".len()).any(|w| w == b"LEGOBatmanLotDK-Win64-Shipping")
            {
                return Some(pid);
            }
        }
        None
    }

    /// A readable, writable memory region.
    pub struct Region {
        pub start: u64,
        pub end: u64,
    }

    /// Writable heap regions only (where the decrypted save lives) — keeps scanning fast.
    pub fn writable_regions(pid: i32) -> std::io::Result<Vec<Region>> {
        let maps = fs::read_to_string(format!("/proc/{pid}/maps"))?;
        let mut out = Vec::new();
        for line in maps.lines() {
            let mut it = line.split_whitespace();
            let range = it.next().unwrap_or("");
            let perms = it.next().unwrap_or("");
            if !perms.starts_with("rw") {
                continue;
            }
            if let Some((a, b)) = range.split_once('-') {
                if let (Ok(start), Ok(end)) = (u64::from_str_radix(a, 16), u64::from_str_radix(b, 16)) {
                    if end - start <= 256 * 1024 * 1024 {
                        out.push(Region { start, end });
                    }
                }
            }
        }
        Ok(out)
    }

    pub fn read_region(pid: i32, r: &Region) -> std::io::Result<Vec<u8>> {
        let mut f = fs::File::open(format!("/proc/{pid}/mem"))?;
        f.seek(SeekFrom::Start(r.start))?;
        let mut buf = vec![0u8; (r.end - r.start) as usize];
        f.read_exact(&mut buf)?;
        Ok(buf)
    }
}
