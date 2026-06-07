import { useRef, useState } from "react";

export function Dropzone({ disabled, onFile }: { disabled: boolean; onFile: (name: string, bytes: Uint8Array) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = async (f: File) => onFile(f.name, new Uint8Array(await f.arrayBuffer()));
  return (
    <div
      className={`dropzone${over ? " over" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => !disabled && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) void take(f);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".sav"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void take(f);
        }}
      />
      <div className="dzInner">
        <div className="dzIcon">🦇</div>
        <strong>{disabled ? "Getting your save ready…" : "Drop a save file here"}</strong>
        <span>or click to choose a <code>SaveSlot_0_TT.sav</code></span>
        <span className="dzHint">
          Found in <code>…/AppData/Local/Warner Bros. Interactive Entertainment/LEGO Batman - Legacy of the Dark Knight/SaveGames/steam/…</code>
        </span>
      </div>
    </div>
  );
}
