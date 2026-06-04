import { useMemo, useState } from "react";
import { enumOptions, type EnumField } from "@tt-save/core";

/** Trim noisy common prefixes so the key reads cleanly. */
function shortContext(ctx: string): string {
  return ctx.replace(/^GameProgress\.Definitions\./, "").replace(/^GameProgress\./, "");
}

export function EnumPanel({
  enums,
  observed,
  onChange,
}: {
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? enums.filter((e) => (e.context ?? "").toLowerCase().includes(needle) || e.enumType.toLowerCase().includes(needle) || e.member.toLowerCase().includes(needle))
      : enums;
    return list.slice(0, 500);
  }, [enums, q]);

  if (enums.length === 0) return null;

  return (
    <section className="card">
      <h2>Discrete settings</h2>
      <p className="hint">Fields with a fixed set of values — pick from the dropdown. The grey key tells duplicates apart (e.g. which collectible / mission).</p>
      <input className="search" placeholder={`Search ${enums.length} settings…`} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="enumList">
        {filtered.map((e, i) => (
          <div key={`${e.valueOffset}-${i}`} className="enumRow">
            <div className="enumLabels">
              <span className="enumType mono">{e.enumType.replace(/^E_?/, "")}</span>
              {e.context && <span className="enumCtx mono" title={e.context}>{shortContext(e.context)}</span>}
            </div>
            <select value={e.member} onChange={(ev) => onChange(e, ev.target.value)}>
              {enumOptions(e.enumType, observed.get(e.enumType), e.member).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {!q && enums.length > 500 && <p className="hint">Showing first 500 of {enums.length}. Use search to narrow down.</p>}
    </section>
  );
}
