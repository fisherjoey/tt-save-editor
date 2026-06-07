import { useMemo } from "react";
import type { CollectibleCounter } from "@tt-save/core";

interface Row {
  key: string;
  label: string;
  verified: boolean;
  have: number;
  total: number;
  /** 0..1 completion ratio (0 when total is 0). */
  ratio: number;
  done: boolean;
}

const pct = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

export function CompletionOverview({
  collectibles,
  present,
}: {
  collectibles: CollectibleCounter[];
  /** Tags currently in the save. */
  present: Set<string>;
}) {
  const rows: Row[] = useMemo(() => {
    const r = collectibles.map((c) => {
      const have = c.tags.reduce((n, t) => n + (present.has(t.tag) ? 1 : 0), 0);
      const total = c.counter;
      return {
        key: c.key,
        label: c.label,
        verified: c.verified,
        have,
        total,
        ratio: total > 0 ? have / total : 0,
        done: total > 0 && have === total,
      };
    });
    // Least-complete first — that's what a completionist wants to act on.
    return r.sort((a, b) => a.ratio - b.ratio || a.label.localeCompare(b.label));
  }, [collectibles, present]);

  if (collectibles.length === 0) return null;

  const have = rows.reduce((n, r) => n + r.have, 0);
  const total = rows.reduce((n, r) => n + r.total, 0);
  const overall = pct(have, total);

  return (
    <section className="card">
      <h2>Your completion</h2>
      <p className="hint">How close you are to 100% across every collectible category.</p>

      <div className="coHeadline">
        <span className="coBig">
          {have} / {total}
        </span>
        <span className="coUnit">collectibles</span>
        <span className="coPct">{overall}%</span>
      </div>
      <div className="coBar coBar--lg" role="progressbar" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100}>
        <div className="coFill" style={{ width: `${overall}%` }} />
      </div>

      <div className="coList">
        {rows.map((r) => (
          <div key={r.key} className="coRow">
            <span className="coLabel">{r.label}</span>
            <div className="coBar">
              <div className="coFill" style={{ width: `${pct(r.have, r.total)}%` }} />
            </div>
            <span className={r.done ? "coCount coCount--done" : "coCount"}>
              {r.done ? "✓ done" : `${r.have}/${r.total}`}
            </span>
            <span className={r.verified ? "badge ok" : "badge warn"}>{r.verified ? "✓ verified" : "untested"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
