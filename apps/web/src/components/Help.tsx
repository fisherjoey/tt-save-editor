export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="helpOverlay" onClick={onClose}>
      <div className="helpPanel" onClick={(e) => e.stopPropagation()}>
        <button className="helpClose" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>What is this?</h2>
        <p>
          A save editor for <strong>LEGO Batman: Legacy of the Dark Knight</strong>. Open a save file, change values, and download the edited copy.
          Everything happens in your browser — your save is never uploaded.
        </p>

        <h3>How to use it</h3>
        <ol>
          <li>
            Drop in your <code>SaveSlot_0_TT.sav</code> (or click <em>Try a sample save</em>). It lives in{" "}
            <code>…/AppData/Local/Warner Bros. Interactive Entertainment/LEGO Batman - Legacy of the Dark Knight/SaveGames/steam/…</code>
          </li>
          <li>Edit values: pick from dropdowns for fixed settings, type into the others, or use a quick action.</li>
          <li>
            Download the patched <code>SaveSlot</code> <strong>and</strong> its <code>BackupCopy</code>, and put both back in that folder (replacing the
            originals — back them up first). The game checks the pair.
          </li>
        </ol>

        <h3>“Make a save load on an older patch”</h3>
        <p>
          When an update changes the game, a save made on the new version won’t load on the old one (<em>“This save was created on an updated version.”</em>)
          — common pain for speedrun practice. This sets the save’s build-version stamp back to the older build so it loads. Enter that build’s number, or load
          a save made on it to read the number automatically.
        </p>

        <h3>Is it safe?</h3>
        <p>
          The tool keeps your save byte-for-byte and only changes the exact values you edit. It refuses to produce a file it can’t reproduce exactly. Still,
          keep a backup of your original before replacing it.
        </p>
      </div>
    </div>
  );
}
