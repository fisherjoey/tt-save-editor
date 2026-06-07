/** Reusable "where do I find my save files" expander — used on the landing Dropzone
 *  and inside the Fix-my-save help, so the find-my-file guidance isn't locked behind Fix mode. */
export function WhereIsMySave({ open = false }: { open?: boolean }): JSX.Element {
  return (
    <details className="fixHelp" open={open}>
      <summary>Where do I find my save?</summary>
      <div className="fixHelpBody">
        <p>
          On <strong>Windows / Steam</strong>, they're here (paste this into the File Explorer address bar —{" "}
          <code>%LOCALAPPDATA%</code> expands automatically):
        </p>
        <p>
          <code>
            %LOCALAPPDATA%\Warner Bros. Interactive Entertainment\LEGO Batman - Legacy of the Dark
            Knight\SaveGames\steam\&lt;your-id&gt;\
          </code>
        </p>
        <p>
          On <strong>Steam Deck or Linux (Proton)</strong> there's no <code>%LOCALAPPDATA%</code>; the same folder
          lives inside the game's Proton prefix:
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
          Inside that folder the saves are named <code>SaveSlot_0_TT.sav</code> (that's slot 0),{" "}
          <code>SaveSlot_1_TT.sav</code>, and so on — one per save slot.
        </p>
      </div>
    </details>
  );
}
