import { useState } from "react";
import { FEATURED_FIELDS, toDisplay, type ScalarField } from "@tt-save/core";

export function QuickEdits({ fields, onEdit }: { fields: ScalarField[]; onEdit: (name: string, value: string) => void }) {
  const present = FEATURED_FIELDS.map((f) => ({ meta: f, field: fields.find((x) => x.name === f.name) })).filter((x) => x.field);
  if (present.length === 0) return null;
  return (
    <section className="card">
      <h2>Quick edits</h2>
      <div className="quickGrid">
        {present.map(({ meta, field }) => (
          <QuickField
            key={meta.name}
            label={meta.label}
            help={meta.help}
            displayValue={toDisplay(field!.value as number | bigint, meta.unit)}
            valid={meta.unit === "hms" ? /^\d{1,3}(:\d{1,2}){0,2}$/ : /^\d+$/}
            onCommit={(v) => onEdit(meta.name, v)}
          />
        ))}
      </div>
    </section>
  );
}

function QuickField({ label, help, displayValue, valid, onCommit }: { label: string; help?: string; displayValue: string; valid: RegExp; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(displayValue);
  const dirty = draft !== displayValue;
  return (
    <label className="quickField">
      <span className="quickLabel">
        {label}
        {help && <span className="quickHelp"> · {help}</span>}
      </span>
      <span className="quickInputRow">
        <input
          className="mono"
          inputMode={valid.source.includes(":") ? "text" : "numeric"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={() => dirty && valid.test(draft) && onCommit(draft)}
        />
        {dirty && <span className="quickDot" title="unsaved change">●</span>}
      </span>
    </label>
  );
}
