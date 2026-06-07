import { useMemo } from "react";
import { summarizeChanges, hasChanges, COLLECTIBLES, friendlyProgressName, enumMemberLabel, prettifyKey, toDisplay, FEATURED_FIELDS } from "@tt-save/core";

const collName = new Map(COLLECTIBLES.flatMap((c) => c.tags.map((t) => [t.tag, t.name] as const)));
const counterLabel = new Map(COLLECTIBLES.flatMap((c) => c.tags.map((t) => [t.tag, c.label] as const)));
const nameFor = (t: string) => collName.get(t) ?? friendlyProgressName(t);

function classify(tag: string, state: string): string {
  if (counterLabel.has(tag)) return counterLabel.get(tag)!;
  if (state.startsWith("ETtMissionGameProgress")) return "Missions";
  if (state.startsWith("ETtObjectivesNodeGameProgress")) return "Objectives";
  if (state.startsWith("ETtChallenge")) return "Challenges";
  return "Other unlocks";
}

const scalarLabel = (name: string) => FEATURED_FIELDS.find((x) => x.name === name)?.label ?? prettifyKey(name);
function fmtScalar(name: string, val: string): string {
  const f = FEATURED_FIELDS.find((x) => x.name === name);
  if (f) {
    try {
      return toDisplay(/^\d+$/.test(val) ? BigInt(val) : val, f.unit);
    } catch {
      return val;
    }
  }
  return /^\d{4,}$/.test(val) ? Number(val).toLocaleString() : val;
}
/** "ETtMissionGameProgress::Complete" → "Done". */
const member = (s: string) => {
  const [type, m] = s.split("::");
  return m ? enumMemberLabel(type!, m) : s;
};

/** Collapse repeated names into [name, count], preserving first-seen order. */
function clump(names: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()];
}

export function ChangeSummary({
  before,
  after,
  originalBuild,
  currentBuild,
}: {
  before: Uint8Array;
  after: Uint8Array;
  originalBuild?: number;
  currentBuild?: number;
}) {
  const c = useMemo(() => summarizeChanges(before, after), [before, after]);
  const buildChanged = originalBuild != null && currentBuild != null && originalBuild !== currentBuild;

  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of c.added) {
      const k = classify(a.tag, a.state);
      (m.get(k) ?? m.set(k, []).get(k)!).push(nameFor(a.tag));
    }
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
  }, [c]);

  if (!hasChanges(c) && !buildChanged) {
    return (
      <section className="card">
        <h2>Your changes</h2>
        <p className="hint">No changes yet — this save is exactly as you opened it.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Your changes</h2>
      <p className="hint">Everything you've changed vs the save you opened — review before you download. You can undo any time with <b>Revert all changes</b> while this tab is open; to keep a safe copy on your computer, use <b>Save a copy of my untouched original</b> first.</p>

      {buildChanged && (
        <div className="diffRow">
          <b>Build version</b> {originalBuild} → {currentBuild}
        </div>
      )}
      {c.scalars.map((s) => (
        <div key={s.name} className="diffRow">
          <b>{scalarLabel(s.name)}</b> {fmtScalar(s.name, s.from)} → {fmtScalar(s.name, s.to)}
        </div>
      ))}

      {groups.map(([cat, names]) => (
        <details key={cat} className="enumGroup">
          <summary>
            <span className="groupTitle">{cat} added</span>
            <span className="groupCount">{names.length}</span>
          </summary>
          <div className="objList">
            {clump(names).slice(0, 60).map(([n, count], i) => (
              <div key={i} className="diffItem">
                ＋ {n}
                {count > 1 && <span className="missionKids">×{count}</span>}
              </div>
            ))}
            {clump(names).length > 60 && <p className="hint">…and {clump(names).length - 60} more</p>}
          </div>
        </details>
      ))}

      {c.stateChanged.length > 0 && (
        <details className="enumGroup">
          <summary>
            <span className="groupTitle">State changes</span>
            <span className="groupCount">{c.stateChanged.length}</span>
          </summary>
          <div className="objList">
            {c.stateChanged.slice(0, 60).map((s, i) => (
              <div key={i} className="diffItem">
                {nameFor(s.tag)}: {member(s.from)} → {member(s.to)}
              </div>
            ))}
            {c.stateChanged.length > 60 && <p className="hint">…and {c.stateChanged.length - 60} more</p>}
          </div>
        </details>
      )}
    </section>
  );
}
