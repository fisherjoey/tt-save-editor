import { enumOptions, type EnumField } from "@tt-save/core";

export function EnumPanel({
  enums,
  observed,
  onChange,
}: {
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  onChange: (field: EnumField, member: string) => void;
}) {
  if (enums.length === 0) return null;
  return (
    <section className="card">
      <h2>Discrete settings</h2>
      <p className="hint">Fields with a fixed set of values — pick from the dropdown.</p>
      <div className="enumGrid">
        {enums.map((e, i) => (
          <label key={`${e.valueOffset}-${i}`} className="enumItem">
            <span className="enumName mono">{e.enumType.replace(/^E/, "")}</span>
            <select value={e.member} onChange={(ev) => onChange(e, ev.target.value)}>
              {enumOptions(e.enumType, observed.get(e.enumType), e.member).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
