import { useMemo, useState } from "react";
import { enumOptions, enumMeta, enumMemberLabel, CATEGORY_LABELS, prettifyKey, type EnumField, type EnumCategory } from "@tt-save/core";

function label(ctx: string): string {
  return prettifyKey(ctx.replace(/^GameProgress\.Definitions\./, "").replace(/^GameProgress\./, ""));
}

const CATEGORY_ORDER: EnumCategory[] = ["progress", "settings", "system"];

// Format/version sentinels that aren't real states a user should pick (a count marker,
// an "unknown", etc.) — hidden from dropdowns so they can't silently break the save.
const SENTINELS = new Set(["VersionCount", "NoVersion", "UnknownVersion"]);

// Missions own their objectives by tag prefix, so we render them as a nested tree
// instead of two flat groups.
const MISSION_TYPE = "ETtMissionGameProgress";
const OBJECTIVE_TYPE = "ETtObjectivesNodeGameProgress";

export function EnumPanel({
  enums,
  observed,
  onChange,
  onBulk,
  onCompleteAll,
}: {
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
  onBulk: (fields: EnumField[], member: string) => void;
  onCompleteAll: () => void;
}) {
  const [q, setQ] = useState("");

  // group by enum type, then by category. Missions + objectives are excluded here —
  // they get their own full-universe panel (CollectiblesPanel-style) below.
  const groups = useMemo(() => {
    const byType = new Map<string, EnumField[]>();
    for (const e of enums) {
      if (!byType.has(e.enumType)) byType.set(e.enumType, []);
      byType.get(e.enumType)!.push(e);
    }
    const byCat: Record<EnumCategory, { type: string; fields: EnumField[] }[]> = { progress: [], settings: [], system: [] };
    for (const [type, fields] of byType) {
      if (type === MISSION_TYPE || type === OBJECTIVE_TYPE) continue;
      byCat[enumMeta(type).category].push({ type, fields });
    }
    for (const cat of CATEGORY_ORDER) byCat[cat].sort((a, b) => enumMeta(a.type).title.localeCompare(enumMeta(b.type).title));
    return byCat;
  }, [enums]);

  if (enums.length === 0) return null;
  const needle = q.trim().toLowerCase();

  return (
    <section className="card">
      <h2>Progress &amp; settings</h2>
      <p className="hint">Game progress and option toggles. Use <b>Set all</b> to change a whole group at once, or expand a group to change individual entries.</p>
      <div className="completeAll">
        <button className="primary" onClick={onCompleteAll}>
          🏆 Mark all progress complete
        </button>
        <span>Marks all collectibles, challenges, missions, and objectives as done. Doesn't add studs or items.</span>
      </div>
      <input className="search" placeholder="Search settings…" value={q} onChange={(e) => setQ(e.target.value)} />

      {CATEGORY_ORDER.map((cat) =>
        groups[cat].length === 0 ? null : (
          <div key={cat} className="enumCat">
            <h3 className="catTitle">{CATEGORY_LABELS[cat]}</h3>
            {cat === "system" && (
              <p className="hint">These control how the game reads the file. Changing them can stop the save from loading — leave them as-is unless you know what you're doing.</p>
            )}
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
  const cur = fields[0]!.member;
  // Hide format/version sentinels that aren't real user-selectable states (keep the current one).
  const options = enumOptions(type, observed.get(type), cur).filter((m) => !SENTINELS.has(m) || m === cur);
  const [bulkVal, setBulkVal] = useState(meta.completeValue && options.includes(meta.completeValue) ? meta.completeValue : options[0]!);
  const visible = needle ? fields.filter((f) => (f.context ?? "").toLowerCase().includes(needle) || f.member.toLowerCase().includes(needle)) : fields;
  if (visible.length === 0) return null;

  // Setting toward anything other than the "done" value (or any change to a setting/system enum) is potentially destructive.
  const applyBulk = () => {
    const destructive = !meta.completeValue || bulkVal !== meta.completeValue;
    if (destructive && fields.length > 1 && !confirm(`Set all ${fields.length} “${meta.title}” to “${enumMemberLabel(type, bulkVal)}”? This changes every entry in this group.`)) return;
    onBulk(fields, bulkVal);
  };

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
                {enumMemberLabel(type, m)}
              </option>
            ))}
          </select>
          <button className="primary small" onClick={applyBulk}>
            Apply to all {fields.length}
          </button>
        </div>
      )}
      <div className="enumList">
        {visible.slice(0, 400).map((e, i) => (
          <div key={`${e.valueOffset}-${i}`} className="enumRow">
            <span className="enumCtx" title={e.context ?? ""}>
              {e.context ? label(e.context) : meta.title}
            </span>
            <select value={e.member} onChange={(ev) => onChange(e, ev.target.value)}>
              {enumOptions(type, observed.get(type), e.member).map((m) => (
                <option key={m} value={m}>
                  {enumMemberLabel(type, m)}
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
