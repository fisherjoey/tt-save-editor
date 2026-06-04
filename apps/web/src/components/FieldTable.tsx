import { useMemo, useState } from "react";
import type { ScalarField } from "@tt-save/core";

export function FieldTable({ fields, onEdit }: { fields: ScalarField[]; onEdit: (field: ScalarField, value: number | bigint | boolean | string) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? fields.filter((f) => f.name.toLowerCase().includes(needle) || f.type.toLowerCase().includes(needle)) : fields;
    return list.slice(0, 600); // cap render for very large saves
  }, [fields, q]);

  return (
    <div>
      <input className="search" placeholder={`Search ${fields.length} fields…`} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tableWrap">
        <table className="fields">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <FieldRow key={`${f.tagOffset}-${i}`} field={f} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="hint">No fields match.</p>}
        {!q && fields.length > 600 && <p className="hint">Showing first 600 of {fields.length}. Use search to find a specific field.</p>}
      </div>
    </div>
  );
}

function FieldRow({ field, onEdit }: { field: ScalarField; onEdit: (f: ScalarField, v: number | bigint | boolean | string) => void }) {
  const [draft, setDraft] = useState<string>(String(field.value));
  const dirty = draft !== String(field.value);

  const commit = () => {
    if (field.kind === "bool") return; // handled by checkbox
    if (field.kind === "string") return onEdit(field, draft);
    if (field.kind === "float") {
      const n = Number(draft);
      if (Number.isFinite(n)) onEdit(field, n);
    } else if (field.type === "Int64Property" || field.type === "UInt64Property") {
      try {
        onEdit(field, BigInt(draft));
      } catch {
        /* ignore bad input */
      }
    } else {
      const n = Number(draft);
      if (Number.isInteger(n)) onEdit(field, n);
    }
  };

  return (
    <tr className={dirty ? "dirty" : ""}>
      <td className="mono name">{field.name}</td>
      <td className="ty">{field.type.replace("Property", "")}</td>
      <td className="val">
        {field.kind === "bool" ? (
          <select value={field.value === true ? "true" : "false"} onChange={(e) => onEdit(field, e.target.value === "true")}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            className="mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        )}
      </td>
    </tr>
  );
}
