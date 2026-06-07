export function FixMySaveHelp({ valid }: { valid: boolean }): JSX.Element {
  return (
    <section className="card fixHelp">
      <h2>Let’s fix your save</h2>

      {valid && (
        <p className="ok">
          ✓ Good news — your save loaded and passed our integrity check, so the file itself isn’t corrupt.
        </p>
      )}

      <p className="hint">
        Take a breath. Nothing here uploads your save or talks to the game — everything happens on this page,
        and your original file on your PC isn’t touched until <em>you</em> put the fixed copy back.
      </p>

      <p>
        The problem this tool fixes most often is the game refusing to load a save with a message like{" "}
        <em>“This save was created on an updated version of the game.”</em> That almost always means the game
        quietly updated itself, and now an older build won’t open a save stamped with the newer version. The
        controls just below roll that version stamp back, so an older build will accept the save again. You don’t
        need to know any numbers off the top of your head — if you have a save that <em>did</em> work on the older
        build, you can hand it to the tool and it reads the right number for you.
      </p>

      <details className="fixHelp">
        <summary>Where are my save files?</summary>
        <div className="fixHelpBody">
          <p>
            On <strong>Windows / Steam</strong>, they’re here (paste this into the File Explorer address bar —{" "}
            <code>%LOCALAPPDATA%</code> expands automatically):
          </p>
          <p>
            <code>
              %LOCALAPPDATA%\Warner Bros. Interactive Entertainment\LEGO Batman - Legacy of the Dark
              Knight\SaveGames\steam\&lt;your-id&gt;\
            </code>
          </p>
          <p>
            On <strong>Steam Deck or Linux (Proton)</strong> there’s no <code>%LOCALAPPDATA%</code>; the same folder
            lives inside the game’s Proton prefix:
          </p>
          <p>
            <code>
              …/steamapps/compatdata/&lt;appid&gt;/pfx/drive_c/users/steamuser/AppData/Local/Warner Bros. Interactive
              Entertainment/LEGO Batman - Legacy of the Dark Knight/SaveGames/steam/&lt;your-id&gt;/
            </code>
          </p>
          <p>
            The <strong>Epic Games</strong> version uses the same{" "}
            <code>…\Warner Bros. Interactive Entertainment\LEGO Batman - Legacy of the Dark Knight\SaveGames\…</code>{" "}
            path, just with an Epic-id subfolder instead of the Steam one.
          </p>
          <p className="hint">
            Inside that folder the saves are named <code>SaveSlot_0_TT.sav</code> (that’s slot 0),{" "}
            <code>SaveSlot_1_TT.sav</code>, and so on — one per save slot.
          </p>
        </div>
      </details>

      <details className="fixHelp">
        <summary>Why are there two files?</summary>
        <div className="fixHelpBody">
          <p>
            For each slot the game keeps your save <strong>and</strong> a backup copy of it — for example{" "}
            <code>SaveSlot_0_TT.sav</code> and <code>BackupCopy_SaveSlot_0_TT.sav</code>. When it loads, the game
            cross-checks the two against each other.
          </p>
          <p>
            That’s why, when you put the fixed save back, you have to replace <strong>both</strong> files with the two
            you download here. If you swap only one, the pair won’t match and the game may reject it. (Back up the
            originals first, just in case.)
          </p>
        </div>
      </details>
    </section>
  );
}
