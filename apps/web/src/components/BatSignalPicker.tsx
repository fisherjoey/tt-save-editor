import { useState } from "react";
import type { EnumField } from "@tt-save/core";

const ENUM = "E_BatsignalProgress";
/** Styles we know exist (the catalogued save was on style 9, so 0–9 are safe to offer
 *  as buttons). The number box lets you go higher if a build has more. */
const KNOWN_MAX = 9;

const parseStyle = (member: string): number => {
  const m = member.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : NaN;
};

/**
 * Change the Bat-signal in the sky. It's a single enum field
 * (BatSignal.CurrentBatSignal → E_BatsignalProgress::NewEnumeratorN), so no
 * chapter-switching is needed (jiggy2g's question). The styles are auto-named
 * (NewEnumerator0…N) and we can't see which number is which look without trying
 * them, so this is a try-it-and-check-in-game tool.
 */
export function BatSignalPicker({ enums, onChange }: { enums: EnumField[]; onChange: (field: EnumField, member: string) => void }) {
  const field = enums.find((e) => e.enumType === ENUM);
  const cur = field ? parseStyle(field.member) : NaN;
  const [draft, setDraft] = useState(Number.isFinite(cur) ? String(cur) : "0");
  const [err, setErr] = useState<string | null>(null);
  if (!field) return null;

  const set = (n: number) => { setErr(null); setDraft(String(n)); onChange(field, `NewEnumerator${n}`); };
  const commit = () => {
    if (!/^\d+$/.test(draft)) { setErr("Whole number only"); return; }
    set(Number(draft));
  };

  return (
    <section className="card">
      <h2>Bat-signal in the sky</h2>
      <p className="hint">
        Changes the Bat-signal style without touching your story progress. The styles are unnamed in the game data, so
        we can't show a preview — <b>set a number, load the game to see it</b>, and try another if it's not the one you
        want. {Number.isFinite(cur) ? <>Currently style <b>{cur}</b>.</> : null} <i>Experimental — Revert all undoes it.</i>
      </p>
      <div className="presetRow">
        {Array.from({ length: KNOWN_MAX + 1 }, (_, n) => (
          <button key={n} className={cur === n ? "chip on" : "chip"} onClick={() => set(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="bulkRow">
        <span>Or set a specific number</span>
        <input
          className="mono"
          inputMode="numeric"
          style={{ width: "5rem" }}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (err) setErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={commit}
        />
        <button className="primary small" onClick={commit}>Set style</button>
      </div>
      {err && <p className="errLine">{err}</p>}
    </section>
  );
}
