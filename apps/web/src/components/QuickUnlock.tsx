import { useMemo, useState } from "react";
import type { CollectibleCounter } from "@tt-save/core";

interface Flat {
  tag: string;
  name: string;
  stateValue: string;
  counterKey: string;
  counterLabel: string;
}

export function QuickUnlock({
  collectibles,
  present,
  onAdd,
}: {
  collectibles: CollectibleCounter[];
  present: Set<string>;
  onAdd: (items: { tag: string; stateValue: string }[]) => void;
}) {
  const [q, setQ] = useState("");

  const flat: Flat[] = useMemo(
    () =>
      collectibles.flatMap((c) =>
        c.tags.map((t) => ({ tag: t.tag, name: t.name, stateValue: c.stateValue, counterKey: c.key, counterLabel: c.label })),
      ),
    [collectibles],
  );

  const presets = useMemo(
    () =>
      [
        { label: "All Batmobiles (cars only)", items: flat.filter((f) => /batmobile/i.test(f.name)) },
        { label: "All vehicles", items: flat.filter((f) => f.counterKey === "Vehicles") },
        { label: "All costumes", items: flat.filter((f) => f.counterKey === "Costumes") },
        { label: "All gold bricks", items: flat.filter((f) => f.counterKey === "GoldBricks") },
        { label: "All Riddler Trophies", items: flat.filter((f) => f.counterKey === "Minikits") },
        { label: "All WayneTech Chips", items: flat.filter((f) => f.counterKey === "WayneTechChips") },
      ].filter((p) => p.items.length > 0),
    [flat],
  );

  const add = (items: Flat[]) => {
    const toAdd = items.filter((i) => !present.has(i.tag)).map((i) => ({ tag: i.tag, stateValue: i.stateValue }));
    if (toAdd.length) onAdd(toAdd);
  };

  const needle = q.trim().toLowerCase();
  const results = needle ? flat.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 50) : [];

  return (
    <section className="card">
      <h2>Unlock specific things</h2>
      <p className="hint">Search for a costume, vehicle, or collectible and add just that — or grab a themed bundle. (Characters are unlocked as costumes.)</p>
      <div className="presetRow">
        {presets.map((p) => {
          const missing = p.items.filter((i) => !present.has(i.tag)).length;
          return (
            <button key={p.label} className="chip" disabled={missing === 0} onClick={() => add(p.items)}>
              {p.label} {missing ? `+${missing}` : "✓"}
            </button>
          );
        })}
      </div>
      <input className="search" placeholder="Search e.g. “Batmobile”, “Robin”, “Riddler”…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="enumList">
        {results.map((r) => {
          const have = present.has(r.tag);
          return (
            <div key={r.tag} className="collRow">
              <span className="collName">
                {r.name}
                <span className="collCat"> · {r.counterLabel}</span>
              </span>
              {have ? <span className="collHave">have</span> : <button className="addBtn" onClick={() => add([r])}>＋ add</button>}
            </div>
          );
        })}
        {needle && results.length === 0 && <p className="hint">No matches — try another word.</p>}
      </div>
    </section>
  );
}
