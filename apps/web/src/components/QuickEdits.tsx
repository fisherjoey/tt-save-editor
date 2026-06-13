import { useState } from "react";
import { FEATURED_FIELDS, toDisplay, type ScalarField, type CollectibleCounter } from "@tt-save/core";

export function QuickEdits({
  fields,
  onEdit,
  counters = [],
  present = new Set<string>(),
  onAddCounter,
}: {
  fields: ScalarField[];
  onEdit: (name: string, value: string) => void;
  /** Collectible counters to surface as currency-style quick actions (e.g. WayneTech chips). */
  counters?: CollectibleCounter[];
  /** Tags already in the save (to compute each counter's current value). */
  present?: Set<string>;
  /** Add collectible entries (used by the counter quick actions). */
  onAddCounter?: (items: { tag: string; stateValue: string }[]) => void;
}) {
  const scalars = FEATURED_FIELDS.map((f) => ({ meta: f, field: fields.find((x) => x.name === f.name) })).filter((x) => x.field);
  const presentCounters = onAddCounter ? counters.filter((c) => c.tags.length > 0) : [];
  if (scalars.length === 0 && presentCounters.length === 0) return null;
  return (
    <section className="card">
      <h2>Quick edits</h2>
      <p className="hint">Your wallet and other top-level totals — the quick stuff. (More detailed editing is further down.)</p>
      <div className="quickGrid">
        {scalars.map(({ meta, field }) => (
          <QuickField
            key={meta.name}
            label={meta.label}
            help={meta.help}
            displayValue={toDisplay(field!.value as number | bigint, meta.unit)}
            valid={meta.unit === "hms" ? /^\d{1,3}(:\d{1,2}){0,2}$/ : /^\d+$/}
            onCommit={(v) => onEdit(meta.name, v)}
          />
        ))}
        {presentCounters.map((c) => (
          <CounterQuickField key={c.key} counter={c} present={present} onAdd={onAddCounter!} />
        ))}
      </div>
    </section>
  );
}

function QuickField({ label, help, displayValue, valid, onCommit }: { label: string; help?: string; displayValue: string; valid: RegExp; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(displayValue);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft !== displayValue;
  const isHms = valid.source.includes(":");
  const commit = () => {
    if (!dirty) return;
    if (valid.test(draft)) {
      setError(null);
      onCommit(draft);
    } else {
      setError(isHms ? "Use hours:minutes:seconds, e.g. 5:00:00" : "Whole number only");
    }
  };
  return (
    <label className="quickField">
      <span className="quickLabel">
        {label}
        {help && <span className="quickHelp"> · {help}</span>}
      </span>
      <span className="quickInputRow">
        <input
          className="mono"
          inputMode={isHms ? "text" : "numeric"}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={commit}
        />
        {dirty && !error && <span className="quickDot" title="unsaved change">●</span>}
      </span>
      {error && <span className="errLine">{error}</span>}
    </label>
  );
}

/**
 * A currency-style quick action for a collectible counter (e.g. WayneTech chips).
 * Unlike studs, the value is the *count of entries* in the save, so we can only add
 * (never remove) — type a higher number, or hit "Max", and we insert the missing ones.
 */
function CounterQuickField({ counter, present, onAdd }: { counter: CollectibleCounter; present: Set<string>; onAdd: (items: { tag: string; stateValue: string }[]) => void }) {
  const have = counter.tags.filter((t) => present.has(t.tag)).length;
  const total = counter.counter;
  const [draft, setDraft] = useState(String(have));
  const [note, setNote] = useState<string | null>(null);
  const dirty = draft !== String(have);

  const missing = () => counter.tags.filter((t) => !present.has(t.tag));

  const addN = (n: number) => {
    const items = missing().slice(0, n).map((t) => ({ tag: t.tag, stateValue: counter.stateValue }));
    if (items.length) onAdd(items);
  };

  const commit = () => {
    if (!/^\d+$/.test(draft)) { setNote("Whole number only"); return; }
    const target = Math.min(Number(draft), total);
    if (target <= have) {
      setNote(target < have ? "Can only add chips, not remove them" : null);
      setDraft(String(have));
      return;
    }
    setNote(null);
    addN(target - have);
    setDraft(String(target));
  };

  return (
    <label className="quickField">
      <span className="quickLabel">
        {counter.label}
        <span className="quickHelp"> · how many you have (of {total}). You can add, not remove.</span>
      </span>
      <span className="quickInputRow">
        <input
          className="mono"
          inputMode="numeric"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (note) setNote(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={commit}
        />
        <span className="quickHelp mono">/{total}</span>
        {have < total && (
          <button type="button" className="addBtn" onClick={() => { setNote(null); setDraft(String(total)); addN(total - have); }}>
            Max
          </button>
        )}
        {dirty && !note && <span className="quickDot" title="unsaved change">●</span>}
      </span>
      {note && <span className="errLine">{note}</span>}
    </label>
  );
}
