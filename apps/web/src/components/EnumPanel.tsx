import { useMemo, useState } from "react";
import { enumOptions, enumMeta, CATEGORY_LABELS, type EnumField, type EnumCategory } from "@tt-save/core";

function shortContext(ctx: string): string {
  return ctx.replace(/^GameProgress\.Definitions\./, "").replace(/^GameProgress\./, "");
}

const CATEGORY_ORDER: EnumCategory[] = ["progress", "settings", "system"];

export function EnumPanel({
  enums,
  observed,
  onChange,
  onBulk,
}: {
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
  onBulk: (fields: EnumField[], member: string) => void;
}) {
  const [q, setQ] = useState("");

  // group by enum type, then by category
  const groups = useMemo(() => {
    const byType = new Map<string, EnumField[]>();
    for (const e of enums) {
      if (!byType.has(e.enumType)) byType.set(e.enumType, []);
      byType.get(e.enumType)!.push(e);
    }
    const byCat: Record<EnumCategory, { type: string; fields: EnumField[] }[]> = { progress: [], settings: [], system: [] };
    for (const [type, fields] of byType) byCat[enumMeta(type).category].push({ type, fields });
    for (const cat of CATEGORY_ORDER) byCat[cat].sort((a, b) => enumMeta(a.type).title.localeCompare(enumMeta(b.type).title));
    return byCat;
  }, [enums]);

  if (enums.length === 0) return null;
  const needle = q.trim().toLowerCase();

  return (
    <section className="card">
      <h2>Progress &amp; settings</h2>
      <p className="hint">Friendly, fixed-choice settings. Use “set all” to change a whole category at once, or expand to tweak individual entries.</p>
      <input className="search" placeholder="Search settings…" value={q} onChange={(e) => setQ(e.target.value)} />

      {CATEGORY_ORDER.map((cat) =>
        groups[cat].length === 0 ? null : (
          <div key={cat} className="enumCat">
            <h3 className="catTitle">{CATEGORY_LABELS[cat]}</h3>
            {groups[cat].map(({ type, fields }) => (
              <EnumGroup key={type} type={type} fields={fields} observed={observed} needle={needle} onChange={onChange} onBulk={onBulk} defaultOpen={cat !== "system"} />
            ))}
          </div>
        ),
      )}
    </section>
  );
}

function EnumGroup({
  type,
  fields,
  observed,
  needle,
  onChange,
  onBulk,
  defaultOpen,
}: {
  type: string;
  fields: EnumField[];
  observed: Map<string, Set<string>>;
  needle: string;
  onChange: (f: EnumField, m: string) => void;
  onBulk: (fields: EnumField[], m: string) => void;
  defaultOpen: boolean;
}) {
  const meta = enumMeta(type);
  const options = enumOptions(type, observed.get(type), fields[0]!.member);
  const [bulkVal, setBulkVal] = useState(meta.completeValue && options.includes(meta.completeValue) ? meta.completeValue : options[0]!);
  const visible = needle ? fields.filter((f) => (f.context ?? "").toLowerCase().includes(needle) || f.member.toLowerCase().includes(needle)) : fields;
  if (visible.length === 0) return null;

  return (
    <details className="enumGroup" open={defaultOpen || !!needle}>
      <summary>
        <span className="groupTitle">{meta.title}</span>
        <span className="groupCount">{fields.length}</span>
      </summary>
      {fields.length > 1 && (
        <div className="bulkRow">
          <span>Set all to</span>
          <select value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}>
            {options.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button className="primary small" onClick={() => onBulk(fields, bulkVal)}>
            Apply to all {fields.length}
          </button>
        </div>
      )}
      <div className="enumList">
        {visible.slice(0, 400).map((e, i) => (
          <div key={`${e.valueOffset}-${i}`} className="enumRow">
            <span className="enumCtx mono" title={e.context ?? ""}>
              {e.context ? shortContext(e.context) : meta.title}
            </span>
            <select value={e.member} onChange={(ev) => onChange(e, ev.target.value)}>
              {enumOptions(type, observed.get(type), e.member).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ))}
        {visible.length > 400 && <p className="hint">Showing first 400 of {visible.length} — use search above.</p>}
      </div>
    </details>
  );
}
