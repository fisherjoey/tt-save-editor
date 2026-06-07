import { useMemo, useState } from "react";
import type { CollectibleCounter, CollectibleTag } from "@tt-save/core";

type FlatTag = CollectibleTag & {
  counterKey: string;
  counterLabel: string;
  stateValue: string;
  verified: boolean;
};

type View = "category" | "mission" | "district";

interface Group {
  key: string;
  label: string;
  /** true/false for category counters; null for mission/district groups (mixed). */
  verified: boolean | null;
  /** Denominator shown next to have/N. */
  counter: number;
  /** Sort key. */
  order: string;
  tags: FlatTag[];
}

const pretty = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");
const pad = (n: number | undefined) => String(n ?? 0).padStart(2, "0");

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
  const [view, setView] = useState<View>("category");
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

  // chapter.mission -> a real mission name (e.g. "Iceberg Lounge (Ch.1 M5)"), from the tag names.
  const missionNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of flat) {
      if (t.facets.source !== "story") continue;
      const key = `${t.facets.chapter}.${t.facets.mission}`;
      const prefix = t.name.split(" — ")[0]!;
      if (/\(Ch\./.test(prefix) && !m.has(key)) m.set(key, prefix);
    }
    return m;
  }, [flat]);

  const groups: Group[] = useMemo(() => {
    if (view === "category") {
      return collectibles.map((c) => ({
        key: c.key,
        label: c.label,
        verified: c.verified,
        counter: c.counter,
        order: c.key,
        tags: flat.filter((t) => t.counterKey === c.key),
      }));
    }
    const map = new Map<string, Group>();
    const push = (key: string, label: string, order: string, t: FlatTag) => {
      let g = map.get(key);
      if (!g) {
        g = { key, label, verified: null, counter: 0, order, tags: [] };
        map.set(key, g);
      }
      g.tags.push(t);
      g.counter = g.tags.length;
    };
    for (const t of flat) {
      const f = t.facets;
      if (view === "mission") {
        if (f.source === "story") {
          const mk = `${f.chapter}.${f.mission}`;
          push(`m:${mk}`, missionNames.get(mk) ?? `Chapter ${f.chapter} · Mission ${f.mission}`, `0:${pad(f.chapter)}.${pad(f.mission)}`, t);
        } else {
          push("free", "Free-roam & activities", "9", t);
        }
      } else {
        // district view
        if (f.district) push(`d:${f.district}`, f.district, `1:${f.district}`, t);
        else if (f.area) push(`a:${f.area}`, pretty(f.area), `2:${f.area}`, t);
        else if (f.source === "story") push("story", "Story missions", "3", t);
        else if (f.source === "shop") push("shop", "Shop", "4", t);
        else push("other", "Other", "5", t);
      }
    }
    return [...map.values()].sort((a, b) => a.order.localeCompare(b.order));
  }, [view, collectibles, flat, missionNames]);

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

  const tab = (v: View, label: string) => (
    <button className={view === v ? "chip on" : "chip"} onClick={() => setView(v)}>
      {label}
    </button>
  );

  return (
    <section className="card">
      <h2>Collectibles</h2>
      <p className="hint">
        Add collectibles to move the in-game counters (gold bricks, Riddler trophies, MicroBuilds…). Names come from
        the game's data. <b>Gold bricks</b> are confirmed working in-game; other categories are added the same way and
        should work too — they just aren't fully confirmed yet. Adding them can't corrupt your save (and Revert all
        undoes anything).
      </p>

      <div className="collTools">
        <div className="viewToggle">
          <span>View by</span>
          {tab("category", "Category")}
          {tab("mission", "Mission")}
          {tab("district", "District")}
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
          <details key={g.key} className="enumGroup" open={!!needle || view !== "category"}>
            <summary>
              <span className="groupTitle">
                {g.label}
                {g.verified === true && <span className="badge ok" title="Confirmed working in-game.">✓ confirmed</span>}
                {g.verified === false && (
                  <span className="badge warn" title="Not yet confirmed in-game — safe to add, but the counter may not move.">
                    not confirmed
                  </span>
                )}
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
                      {view !== "category" && <span className="collCat"> · {t.counterLabel}</span>}
                    </span>
                    {inSave ? (
                      <span className="collHave">have</span>
                    ) : (
                      t.confidence !== "high" && (
                        <span className="collConf" title="We're less certain this is the exact in-game item — safe to add, but it may not register.">
                          unverified
                        </span>
                      )
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
