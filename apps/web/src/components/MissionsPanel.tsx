import { useMemo, useState, type ReactNode } from "react";
import {
  enumOptions,
  prettifyKey,
  PROGRESS_MISSION_TAGS,
  PROGRESS_OBJECTIVE_TAGS,
  PROGRESS_NAMES,
  MISSION_COMPLETE_STATE,
  OBJECTIVE_COMPLETE_STATE,
  type EnumField,
} from "@tt-save/core";

const MISSION_TYPE = "ETtMissionGameProgress";
const OBJECTIVE_TYPE = "ETtObjectivesNodeGameProgress";

const strip = (tag: string) => prettifyKey(tag.replace(/^GameProgress\.Definitions\./, ""));
const topCategory = (tag: string) => tag.replace(/^GameProgress\.Definitions\./, "").split(".")[0]!;
/** Linear order for story missions (Story.CC.MM), or null if not a story mission. */
const storyOrder = (tag: string): number | null => {
  const m = tag.match(/\.Story\.(\d+)\.(\d+)$/);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
};

// Real in-game names from the game's ST_Objective string table + PROG_ mission assets
// (built into PROGRESS_NAMES); anything unmapped falls back to a prettified tag path.
function missionName(tag: string): string {
  return PROGRESS_NAMES[tag] ?? strip(tag);
}
const objName = (tag: string): string => PROGRESS_NAMES[tag] ?? strip(tag);

interface MissionNode {
  tag: string;
  name: string;
  category: string;
  objectives: string[];
}

/** A <details> that renders its children only once opened (or when forced open by search). */
function LazyDetails({
  className,
  forceOpen,
  summary,
  children,
}: {
  className: string;
  forceOpen: boolean;
  summary: ReactNode;
  children: () => ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const show = forceOpen || opened;
  return (
    <details
      className={className}
      open={forceOpen || undefined}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true);
      }}
    >
      <summary>{summary}</summary>
      {show && children()}
    </details>
  );
}

export function MissionsPanel({
  enums,
  present,
  observed,
  onChange,
  onAdd,
  onCompleteMany,
}: {
  enums: EnumField[];
  /** Real array-element tags currently in the save (authoritative presence). */
  present: Set<string>;
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
  onAdd: (tags: string[], state: string) => void;
  /** Complete a batch of missions + objectives (add missing + set present to Complete), offset-safe. */
  onCompleteMany: (missionTags: string[], objTags: string[]) => void;
}) {
  const [q, setQ] = useState("");

  // Editable fields, keyed by scanEnums context. Used only to EDIT entries that are
  // present; presence itself comes from the authoritative `present` tag set.
  const fields = useMemo(() => {
    const map = new Map<string, EnumField>();
    for (const e of enums) {
      if ((e.enumType === MISSION_TYPE || e.enumType === OBJECTIVE_TYPE) && e.context) map.set(e.context, e);
    }
    return map;
  }, [enums]);

  const { categories, orphans, objByMission, storyMissionsOrdered } = useMemo(() => {
    const missionSet = new Set(PROGRESS_MISSION_TAGS);
    const objByMission = new Map<string, string[]>();
    const orphans: string[] = [];
    for (const o of PROGRESS_OBJECTIVE_TAGS) {
      const parts = o.split(".");
      let parent: string | undefined;
      for (let i = parts.length - 1; i > 0; i--) {
        const cand = parts.slice(0, i).join(".");
        if (missionSet.has(cand)) {
          parent = cand;
          break;
        }
      }
      if (parent) (objByMission.get(parent) ?? objByMission.set(parent, []).get(parent)!).push(o);
      else orphans.push(o);
    }
    const byCat = new Map<string, MissionNode[]>();
    for (const tag of PROGRESS_MISSION_TAGS) {
      const node: MissionNode = { tag, name: missionName(tag), category: topCategory(tag), objectives: objByMission.get(tag) ?? [] };
      (byCat.get(node.category) ?? byCat.set(node.category, []).get(node.category)!).push(node);
    }
    for (const list of byCat.values()) list.sort((a, b) => a.tag.localeCompare(b.tag));
    const storyMissionsOrdered = PROGRESS_MISSION_TAGS.filter((t) => storyOrder(t) !== null).sort((a, b) => storyOrder(a)! - storyOrder(b)!);
    return { categories: [...byCat.entries()].sort((a, b) => b[1].length - a[1].length), orphans, objByMission, storyMissionsOrdered };
  }, []);

  const completeUpTo = (targetTag: string) => {
    const target = storyOrder(targetTag);
    if (target == null) return;
    const mt: string[] = [];
    const ot: string[] = [];
    for (const m of storyMissionsOrdered) {
      if (storyOrder(m)! > target) break;
      mt.push(m);
      ot.push(...(objByMission.get(m) ?? []));
    }
    onCompleteMany(mt, ot);
  };

  const needle = q.trim().toLowerCase();
  const hit = (tag: string, name?: string) =>
    !needle || tag.toLowerCase().includes(needle) || (name ?? "").toLowerCase().includes(needle);
  const nodeMatches = (n: MissionNode) => hit(n.tag, n.name) || n.objectives.some((o) => hit(o, objName(o)));

  const total = PROGRESS_MISSION_TAGS.length + PROGRESS_OBJECTIVE_TAGS.length;
  const presentCount = useMemo(() => {
    let n = 0;
    for (const t of PROGRESS_MISSION_TAGS) if (present.has(t)) n++;
    for (const t of PROGRESS_OBJECTIVE_TAGS) if (present.has(t)) n++;
    return n;
  }, [present]);

  return (
    <section className="card">
      <h2>Missions &amp; objectives</h2>
      <p className="hint">
        Every mission &amp; objective in the game ({total.toLocaleString()} total) — not just the ones in your
        save. Ones you have show a state dropdown; ones you haven't reached show <b>＋ add</b>. ⚠ Adding missions
        you haven't reached is advanced and untested — it can affect story progression. In your save:{" "}
        <b>{presentCount.toLocaleString()}</b> of {total.toLocaleString()} present.
      </p>
      <input className="search" placeholder="Search missions & objectives…" value={q} onChange={(e) => setQ(e.target.value)} />

      {categories.map(([cat, nodes]) => {
        const matching = needle ? nodes.filter(nodeMatches) : nodes;
        if (!matching.length) return null;
        const have = nodes.filter((n) => present.has(n.tag)).length;
        return (
          <LazyDetails
            key={cat}
            className="enumGroup"
            forceOpen={!!needle}
            summary={
              <>
                <span className="groupTitle">{prettifyKey(cat)}</span>
                <span className="groupCount">
                  {have}/{nodes.length}
                </span>
              </>
            }
          >
            {() => (
              <div className="missionTree">
                {matching.slice(0, 300).map((n) => (
                  <MissionRow
                    key={n.tag}
                    node={n}
                    present={present}
                    fields={fields}
                    observed={observed}
                    needle={needle}
                    onChange={onChange}
                    onAdd={onAdd}
                    onComplete={() => onCompleteMany([n.tag], n.objectives)}
                    onUpTo={storyOrder(n.tag) != null ? () => completeUpTo(n.tag) : undefined}
                  />
                ))}
                {matching.length > 300 && <p className="hint">Showing first 300 of {matching.length} — use search.</p>}
              </div>
            )}
          </LazyDetails>
        );
      })}

      {orphans.length > 0 && (!needle || orphans.some((o) => hit(o, objName(o)))) && (
        <LazyDetails
          className="enumGroup"
          forceOpen={!!needle}
          summary={
            <>
              <span className="groupTitle">Unlinked objectives</span>
              <span className="groupCount">{orphans.length}</span>
            </>
          }
        >
          {() => (
            <div className="objList">
              {(needle ? orphans.filter((o) => hit(o, objName(o))) : orphans).slice(0, 300).map((o) => (
                <EntryRow key={o} tag={o} type={OBJECTIVE_TYPE} addState={OBJECTIVE_COMPLETE_STATE} present={present} fields={fields} observed={observed} onChange={onChange} onAdd={onAdd} />
              ))}
            </div>
          )}
        </LazyDetails>
      )}
    </section>
  );
}

function MissionRow({
  node,
  present,
  fields,
  observed,
  needle,
  onChange,
  onAdd,
  onComplete,
  onUpTo,
}: {
  node: MissionNode;
  present: Set<string>;
  fields: Map<string, EnumField>;
  observed: Map<string, Set<string>>;
  needle: string;
  onChange: (field: EnumField, member: string) => void;
  onAdd: (tags: string[], state: string) => void;
  /** Complete this mission + its objectives (offset-safe, handled by the parent). */
  onComplete: () => void;
  /** Complete this story mission and every earlier one. Undefined for non-story missions. */
  onUpTo?: () => void;
}) {
  const missing = (present.has(node.tag) ? 0 : 1) + node.objectives.filter((o) => !present.has(o)).length;
  return (
    <LazyDetails
      className="missionNode"
      forceOpen={!!needle}
      summary={
        <>
          <span className="missionTitle">{node.name}</span>
          {present.has(node.tag) ? (
            <span className="missionState">{fields.get(node.tag)?.member ?? "present"}</span>
          ) : (
            <span className="badge warn">not reached</span>
          )}
          {node.objectives.length > 0 && <span className="missionKids">{node.objectives.length} obj.</span>}
        </>
      }
    >
      {() => (
        <div className="objList">
          <div className="enumRow">
            <span className="enumCtx">
              <b>Mission state</b>
            </span>
            <EntryControl tag={node.tag} type={MISSION_TYPE} addState={MISSION_COMPLETE_STATE} present={present} fields={fields} observed={observed} onChange={onChange} onAdd={onAdd} />
          </div>
          {(missing > 0 || onUpTo) && (
            <div className="bulkRow">
              {missing > 0 && (
                <button className="primary small" onClick={onComplete}>
                  Complete this mission{node.objectives.length ? ` + ${node.objectives.length} obj.` : ""}
                </button>
              )}
              {onUpTo && (
                <button className="small ghost" onClick={onUpTo} title="Mark this story mission and every earlier one (and their objectives) complete">
                  ⏩ Complete everything up to here
                </button>
              )}
            </div>
          )}
          {node.objectives.map((o) => (
            <EntryRow key={o} tag={o} type={OBJECTIVE_TYPE} addState={OBJECTIVE_COMPLETE_STATE} present={present} fields={fields} observed={observed} onChange={onChange} onAdd={onAdd} />
          ))}
        </div>
      )}
    </LazyDetails>
  );
}

function EntryRow(props: {
  tag: string;
  type: string;
  addState: string;
  present: Set<string>;
  fields: Map<string, EnumField>;
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
  onAdd: (tags: string[], state: string) => void;
}) {
  return (
    <div className="enumRow objRow">
      <span className="enumCtx" title={props.tag}>
        {objName(props.tag)}
      </span>
      <EntryControl {...props} />
    </div>
  );
}

function EntryControl({
  tag,
  type,
  addState,
  present,
  fields,
  observed,
  onChange,
  onAdd,
}: {
  tag: string;
  type: string;
  addState: string;
  present: Set<string>;
  fields: Map<string, EnumField>;
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
  onAdd: (tags: string[], state: string) => void;
}) {
  const field = fields.get(tag);
  if (field) {
    return (
      <select value={field.member} onChange={(e) => onChange(field, e.target.value)}>
        {enumOptions(type, observed.get(type), field.member).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    );
  }
  // Present in the array but no editable field located (rare scanEnums/real-tag mismatch).
  if (present.has(tag)) return <span className="collHave">present</span>;
  return (
    <button className="addBtn" onClick={() => onAdd([tag], addState)} title="Add as complete">
      ＋ add
    </button>
  );
}
