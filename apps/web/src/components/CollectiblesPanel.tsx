import { useMemo, useState } from "react";
import type { CollectibleCounter, CollectibleTag } from "@tt-save/core";

type FlatTag = CollectibleTag & {
  counterKey: string;
  counterLabel: string;
  stateValue: string;
  verified: boolean;
};

const SOURCE_ORDER = ["story", "hub", "shop", "other"] as const;
const SOURCE_LABELS: Record<string, string> = {
  story: "Story missions",
  hub: "Free-roam / hub",
  shop: "Shop",
  other: "Other",
};

export function CollectiblesPanel({
  collectibles,
  present,
  onAdd,
}: {
  collectibles: CollectibleCounter[];
  /** Tags already in the save. */
  present: Set<string>;
  onAdd: (items: { tag: string; stateValue: string }[]) => void;
}) {
  const [view, setView] = useState<"category" | "source">("category");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const flat: FlatTag[] = useMemo(
    () =>
      collectibles.flatMap((c) =>
        c.tags.map((t) => ({ ...t, counterKey: c.key, counterLabel: c.label, stateValue: c.stateValue, verified: c.verified })),
      ),
    [collectibles],
  );
  const stateByTag = useMemo(() => new Map(flat.map((t) => [t.tag, t.stateValue])), [flat]);

  const groups = useMemo(() => {
    if (view === "category") {
      return collectibles.map((c) => ({
        key: c.key,
        label: c.label,
        verified: c.verified,
        counter: c.counter,
        tags: flat.filter((t) => t.counterKey === c.key),
      }));
    }
    return SOURCE_ORDER.map((src) => {
      const tags = flat.filter((t) => t.facets.source === src);
      return { key: src, label: SOURCE_LABELS[src]!, verified: false, counter: tags.length, tags };
    }).filter((g) => g.tags.length > 0);
  }, [view, collectibles, flat]);

  if (collectibles.length === 0) return null;

  const needle = q.trim().toLowerCase();
  const matches = (t: FlatTag) =>
    !needle || t.name.toLowerCase().includes(needle) || t.tag.toLowerCase().includes(needle);

  const toggle = (tag: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(tag) ? n.delete(tag) : n.add(tag);
      return n;
    });

  const addTags = (tags: string[]) => {
    const items = tags.filter((t) => !present.has(t)).map((t) => ({ tag: t, stateValue: stateByTag.get(t)! }));
    if (items.length) onAdd(items);
  };
  const addSelected = () => {
    addTags([...selected]);
    setSelected(new Set());
  };

  return (
    <section className="card">
      <h2>Collectibles</h2>
      <p className="hint">
        Add collectibles to move the in-game counters (gold bricks, minikits, trophies…). Names come from the
        game's data. <b>Gold bricks</b> are verified in-game; other categories should work but are untested.
      </p>

      <div className="collTools">
        <div className="viewToggle">
          <span>View by</span>
          <button className={view === "category" ? "chip on" : "chip"} onClick={() => setView("category")}>
            Category
          </button>
          <button className={view === "source" ? "chip on" : "chip"} onClick={() => setView("source")}>
            Source
          </button>
        </div>
        <button className="primary" onClick={() => addTags(flat.map((t) => t.tag))}>
          Max out everything
        </button>
      </div>

      <input className="search" placeholder="Search collectibles…" value={q} onChange={(e) => setQ(e.target.value)} />

      {groups.map((g) => {
        const visible = g.tags.filter(matches);
        if (!visible.length) return null;
        const have = g.tags.filter((t) => present.has(t.tag)).length;
        const missing = g.tags.filter((t) => !present.has(t.tag)).map((t) => t.tag);
        return (
          <details key={g.key} className="enumGroup" open={!!needle || view === "source"}>
            <summary>
              <span className="groupTitle">
                {g.label}
                {view === "category" &&
                  (g.verified ? (
                    <span className="badge ok">✓ verified</span>
                  ) : (
                    <span className="badge warn">untested</span>
                  ))}
              </span>
              <span className="groupCount">
                {have}/{g.counter}
              </span>
            </summary>
            <div className="bulkRow">
              <button className="primary small" disabled={!missing.length} onClick={() => addTags(missing)}>
                Max out (+{missing.length})
              </button>
            </div>
            <div className="enumList">
              {visible.slice(0, 400).map((t) => {
                const inSave = present.has(t.tag);
                return (
                  <label key={t.tag} className="collRow">
                    <input
                      type="checkbox"
                      disabled={inSave}
                      checked={inSave || selected.has(t.tag)}
                      onChange={() => toggle(t.tag)}
                    />
                    <span className="collName" title={t.tag}>
                      {t.name}
                    </span>
                    {inSave ? (
                      <span className="collHave">have</span>
                    ) : (
                      t.confidence !== "high" && <span className="collConf">{t.confidence}</span>
                    )}
                  </label>
                );
              })}
              {visible.length > 400 && <p className="hint">Showing first 400 of {visible.length} — use search.</p>}
            </div>
          </details>
        );
      })}

      {selected.size > 0 && (
        <div className="addBar">
          <button className="primary" onClick={addSelected}>
            Add selected ({selected.size})
          </button>
          <button className="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}
