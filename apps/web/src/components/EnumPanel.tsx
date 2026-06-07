import { useMemo, useState } from "react";
import { enumOptions, enumMeta, CATEGORY_LABELS, prettifyKey, type EnumField, type EnumCategory } from "@tt-save/core";

function label(ctx: string): string {
  return prettifyKey(ctx.replace(/^GameProgress\.Definitions\./, "").replace(/^GameProgress\./, ""));
}

const CATEGORY_ORDER: EnumCategory[] = ["progress", "settings", "system"];

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

  // group by enum type, then by category — but pull missions + objectives out to
  // render as a nested tree instead of two flat groups.
  const { groups, missions, objectives } = useMemo(() => {
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
    return { groups: byCat, missions: byType.get(MISSION_TYPE) ?? [], objectives: byType.get(OBJECTIVE_TYPE) ?? [] };
  }, [enums]);

  if (enums.length === 0) return null;
  const needle = q.trim().toLowerCase();

  return (
    <section className="card">
      <h2>Progress &amp; settings</h2>
      <p className="hint">Friendly, fixed-choice settings. Use “set all” to change a whole category at once, or expand to tweak individual entries.</p>
      <div className="completeAll">
        <button className="primary" onClick={onCompleteAll}>
          🏆 Complete everything
        </button>
        <span>Marks all collectibles, challenges, missions, and objectives as done.</span>
      </div>
      <input className="search" placeholder="Search settings…" value={q} onChange={(e) => setQ(e.target.value)} />

      {CATEGORY_ORDER.map((cat) =>
        groups[cat].length === 0 ? null : (
          <div key={cat} className="enumCat">
            <h3 className="catTitle">{CATEGORY_LABELS[cat]}</h3>
            {cat === "progress" && (missions.length > 0 || objectives.length > 0) && (
              <MissionTree missions={missions} objectives={objectives} observed={observed} needle={needle} onChange={onChange} onBulk={onBulk} />
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
            <span className="enumCtx" title={e.context ?? ""}>
              {e.context ? label(e.context) : meta.title}
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

function ObjRow({
  field,
  observed,
  onChange,
}: {
  field: EnumField;
  observed: Map<string, Set<string>>;
  onChange: (f: EnumField, m: string) => void;
}) {
  return (
    <div className="enumRow objRow">
      <span className="enumCtx" title={field.context ?? ""}>
        {field.context ? label(field.context) : "Objective"}
      </span>
      <select value={field.member} onChange={(e) => onChange(field, e.target.value)}>
        {enumOptions(OBJECTIVE_TYPE, observed.get(OBJECTIVE_TYPE), field.member).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Missions as collapsible nodes; each mission's objectives (matched by tag prefix) nest inside. */
function MissionTree({
  missions,
  objectives,
  observed,
  needle,
  onChange,
  onBulk,
}: {
  missions: EnumField[];
  objectives: EnumField[];
  observed: Map<string, Set<string>>;
  needle: string;
  onChange: (f: EnumField, m: string) => void;
  onBulk: (fields: EnumField[], m: string) => void;
}) {
  const { rows, orphans } = useMemo(() => {
    const sorted = [...missions].sort((a, b) => (a.context ?? "").localeCompare(b.context ?? ""));
    const used = new Set<EnumField>();
    const rows = sorted.map((m) => {
      const kids = m.context ? objectives.filter((o) => o.context?.startsWith(m.context + ".")) : [];
      kids.forEach((k) => used.add(k));
      return { mission: m, kids };
    });
    const orphans = objectives.filter((o) => !used.has(o));
    return { rows, orphans };
  }, [missions, objectives]);

  const hit = (f: EnumField) =>
    !needle ||
    (f.context ?? "").toLowerCase().includes(needle) ||
    label(f.context ?? "").toLowerCase().includes(needle) ||
    f.member.toLowerCase().includes(needle);

  const visibleRows = rows.filter((r) => hit(r.mission) || r.kids.some(hit));
  const visibleOrphans = orphans.filter(hit);
  if (!visibleRows.length && !visibleOrphans.length) return null;

  return (
    <details className="enumGroup" open>
      <summary>
        <span className="groupTitle">Missions &amp; objectives</span>
        <span className="groupCount">{missions.length + objectives.length}</span>
      </summary>
      <div className="missionTree">
        {visibleRows.map((r, i) => {
          const kids = needle ? r.kids.filter(hit) : r.kids;
          return (
            <details key={(r.mission.context ?? "m") + i} className="missionNode" open={!!needle}>
              <summary>
                <span className="missionTitle">{r.mission.context ? label(r.mission.context) : "Mission"}</span>
                <span className="missionState">{r.mission.member}</span>
                {r.kids.length > 0 && <span className="missionKids">{r.kids.length} obj.</span>}
              </summary>
              <div className="objList">
                <div className="enumRow">
                  <span className="enumCtx">
                    <b>Mission state</b>
                  </span>
                  <select value={r.mission.member} onChange={(e) => onChange(r.mission, e.target.value)}>
                    {enumOptions(MISSION_TYPE, observed.get(MISSION_TYPE), r.mission.member).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                {r.kids.length > 0 && (
                  <div className="bulkRow">
                    <button className="primary small" onClick={() => onBulk([r.mission, ...r.kids], "Complete")}>
                      Complete mission + {r.kids.length} objective{r.kids.length === 1 ? "" : "s"}
                    </button>
                  </div>
                )}
                {kids.map((o, j) => (
                  <ObjRow key={(o.context ?? "o") + j} field={o} observed={observed} onChange={onChange} />
                ))}
              </div>
            </details>
          );
        })}
        {visibleOrphans.length > 0 && (
          <details className="missionNode" open={!!needle}>
            <summary>
              <span className="missionTitle">Other objectives</span>
              <span className="missionKids">{orphans.length}</span>
            </summary>
            <div className="objList">
              {visibleOrphans.map((o, j) => (
                <ObjRow key={(o.context ?? "o") + j} field={o} observed={observed} onChange={onChange} />
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
