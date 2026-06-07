import { useCallback, useEffect, useMemo, useState } from "react";
import { SaveFile, readBuildVersion, downgradeRecipe, FEATURED_FIELDS, fromDisplay, COLLECTIBLES, type ScalarField, type EnumField } from "@tt-save/core";
import { Dropzone } from "./components/Dropzone.js";
import { FieldTable } from "./components/FieldTable.js";
import { EnumPanel } from "./components/EnumPanel.js";
import { QuickEdits } from "./components/QuickEdits.js";
import { CollectiblesPanel } from "./components/CollectiblesPanel.js";
import { MissionsPanel } from "./components/MissionsPanel.js";
import { CompletionOverview } from "./components/CompletionOverview.js";
import { UnlockEverythingPanel } from "./components/UnlockEverythingPanel.js";
import { QuickUnlock } from "./components/QuickUnlock.js";
import { FixMySaveHelp } from "./components/FixMySaveHelp.js";
import { Help } from "./components/Help.js";

type Mode = "choose" | "fix" | "unlock" | "fill" | "edit";

interface Loaded {
  fileName: string;
  save: SaveFile;
  originalBytes: Uint8Array;
  fields: ScalarField[];
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  collPresent: Set<string>;
}

function downloadBytes(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Turn a raw load error into a plain-language cause + next step. */
function explainError(msg: string): { title: string; detail: string } {
  const m = msg.toLowerCase();
  if (m.includes("gvas") || m.includes("magic") || m.includes("not a "))
    return { title: "That doesn't look like a LEGO Batman save", detail: "Pick a file named like SaveSlot_0_TT.sav from the game's SaveGames folder — not a screenshot, a settings file, or another game's save." };
  if (m.includes("round") || m.includes("reproduce") || m.includes("refus"))
    return { title: "We couldn't safely read this save", detail: "It may be from a newer game version than we support, or the file is partly damaged. Try the matching BackupCopy_… file instead." };
  if (m.includes("decrypt") || m.includes("key") || m.includes("range") || m.includes("length") || m.includes("bounds"))
    return { title: "This save looks damaged or unreadable", detail: "If it's a real SaveSlot_…_TT.sav, it may be corrupted — try the matching BackupCopy_… file, which the game keeps as a spare." };
  return { title: "Couldn't open that save", detail: `${msg}. If it's a real SaveSlot_…_TT.sav, try the matching BackupCopy_… file.` };
}

function collectibleCompletion(present: Set<string>) {
  let have = 0;
  let total = 0;
  for (const c of COLLECTIBLES) {
    total += c.counter;
    have += c.tags.filter((t) => present.has(t.tag)).length;
  }
  return { have, total, pct: total ? Math.round((have / total) * 100) : 0 };
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockResult, setUnlockResult] = useState<{ collectiblesAdded: number; progressCompleted: number; studsSet: number } | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const onFile = useCallback((name: string, bytes: Uint8Array) => {
    setError(null);
    setMode("choose");
    setUnlockResult(null);
    try {
      const save = SaveFile.load(bytes);
      setLoaded({
        fileName: name,
        save,
        originalBytes: bytes,
        fields: save.fields(),
        enums: save.enums(),
        observed: save.observedEnums(),
        collPresent: new Set(save.enumArrayEntries().map((e) => e.tag)),
      });
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshFields = useCallback(() => {
    setLoaded((l) =>
      l
        ? {
            ...l,
            fields: l.save.fields(),
            enums: l.save.enums(),
            observed: l.save.observedEnums(),
            collPresent: new Set(l.save.enumArrayEntries().map((e) => e.tag)),
          }
        : l,
    );
  }, []);

  const loadSample = useCallback(async () => {
    const buf = await fetch("./sample.sav").then((r) => r.arrayBuffer());
    onFile("SaveSlot_0_TT.sav", new Uint8Array(buf));
  }, [onFile]);

  // Optional larger sample (a 100% save) — only present in local builds, and
  // file:// can't fetch at all so don't bother probing.
  const [hasBigSample, setHasBigSample] = useState(false);
  useEffect(() => {
    if (typeof location !== "undefined" && location.protocol === "file:") return;
    fetch("./sample-100.sav", { method: "HEAD" })
      .then((r) => setHasBigSample(r.ok))
      .catch(() => setHasBigSample(false));
  }, []);
  const loadBigSample = useCallback(async () => {
    const buf = await fetch("./sample-100.sav").then((r) => r.arrayBuffer());
    onFile("SaveSlot_0_TT.sav", new Uint8Array(buf));
  }, [onFile]);

  const buildVersion = loaded ? readBuildVersion(loaded.save) : undefined;

  return (
    <div className="app">
      <button className="helpBtn" onClick={() => setHelp(true)} aria-label="What is this?" title="What is this?">
        ?
      </button>
      {help && <Help onClose={() => setHelp(false)} />}

      <header className="masthead">
        <h1>
          TT Save Editor <span className="bat">🦇</span>
        </h1>
        <p className="sub">LEGO Batman: Legacy of the Dark Knight — edit any field, or make a save load on an older patch.</p>
        <p className="privacy">
          Your save is decrypted and edited entirely in your browser. Nothing is ever uploaded. <button className="link" onClick={() => setHelp(true)}>How it works</button>
        </p>
      </header>

      {!loaded && (
        <>
          <Dropzone disabled={false} onFile={onFile} />
          {typeof location !== "undefined" && location.protocol !== "file:" && (
            <p className="sampleLine">
              No save handy? <button className="link" onClick={loadSample}>Try a sample save</button> — edit and download it to see how it works.
              {hasBigSample && (
                <>
                  {" · "}
                  <button className="link" onClick={loadBigSample}>Try a 100% save (large)</button>
                </>
              )}
            </p>
          )}
        </>
      )}
      {error &&
        (() => {
          const ex = explainError(error);
          return (
            <div className="banner err">
              <strong>{ex.title}</strong>
              <span>{ex.detail}</span>
            </div>
          );
        })()}

      {loaded &&
        (() => {
          const l = loaded;
          const comp = collectibleCompletion(l.collPresent);

          const onErr = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
          const onQuickEdit = (name: string, value: string) => {
            try {
              const f = l.fields.find((x) => x.name === name);
              const meta = FEATURED_FIELDS.find((x) => x.name === name);
              const raw = meta?.unit ? fromDisplay(value, meta.unit) : value;
              const v = f?.type === "Int64Property" || f?.type === "UInt64Property" ? (typeof raw === "bigint" ? raw : BigInt(raw as number | string)) : Number(raw);
              l.save.setFieldAll(name, v);
              for (const ln of meta?.linkedNames ?? []) l.save.setFieldAll(ln, v);
              refreshFields();
            } catch (e) { onErr(e); }
          };
          const onEnumChange = (field: EnumField, member: string) => { try { l.save.setEnum(field, member); refreshFields(); } catch (e) { onErr(e); } };
          const onEnumBulk = (fields: EnumField[], member: string) => { try { l.save.setEnumsBulk(fields, member); refreshFields(); } catch (e) { onErr(e); } };
          const onCompleteAll = () => { try { l.save.completeAllProgress(); refreshFields(); } catch (e) { onErr(e); } };
          const onAddEntries = (tags: string[], state: string) => { try { l.save.addEntries(tags, state); refreshFields(); } catch (e) { onErr(e); } };
          // Complete a batch of missions + objectives safely: add the missing ones first
          // (this shifts byte offsets), then set present ones via the offset-safe bulk path.
          const onCompleteMany = (missionTags: string[], objTags: string[]) => {
            try {
              const have = new Set(l.save.enumArrayEntries().map((e) => e.tag));
              l.save.addEntries(missionTags.filter((t) => !have.has(t)), "ETtMissionGameProgress::Complete");
              l.save.addEntries(objTags.filter((t) => !have.has(t)), "ETtObjectivesNodeGameProgress::Complete");
              const want = new Set([...missionTags, ...objTags]);
              const toFix = l.save.enums().filter(
                (e) => !!e.context && want.has(e.context) && (e.enumType === "ETtMissionGameProgress" || e.enumType === "ETtObjectivesNodeGameProgress") && e.member !== "Complete",
              );
              if (toFix.length) l.save.setEnumsBulk(toFix, "Complete");
              refreshFields();
            } catch (e) { onErr(e); }
          };
          const onCollAdd = (items: { tag: string; stateValue: string }[]) => {
            try {
              const byState = new Map<string, string[]>();
              for (const it of items) { if (!byState.has(it.stateValue)) byState.set(it.stateValue, []); byState.get(it.stateValue)!.push(it.tag); }
              for (const [state, tags] of byState) l.save.addEntries(tags, state);
              refreshFields();
            } catch (e) { onErr(e); }
          };
          const onFieldEdit = (field: ScalarField, value: number | bigint | boolean | string) => { try { l.save.setField(field.name, value); refreshFields(); } catch (e) { onErr(e); } };
          const STUDS_MAX = 999999999;
          const maxStuds = () => {
            const studs = FEATURED_FIELDS.find((f) => /stud/i.test(f.name) || (f.label ?? "").toLowerCase().includes("stud"));
            if (studs) { l.save.setFieldAll(studs.name, STUDS_MAX); for (const ln of studs.linkedNames ?? []) l.save.setFieldAll(ln, STUDS_MAX); }
          };
          // completeStory=false leaves the story playable ("everything for free roam").
          const runUnlock = (completeStory: boolean) => {
            setUnlocking(true);
            setTimeout(() => {
              try {
                let added = 0;
                for (const c of COLLECTIBLES) added += l.save.addEntries(c.tags.map((t) => t.tag), c.stateValue);
                const completed = completeStory ? l.save.completeAllProgress() : 0;
                maxStuds();
                setUnlockResult({ collectiblesAdded: added, progressCompleted: completed, studsSet: STUDS_MAX });
                refreshFields();
              } catch (e) { onErr(e); } finally { setUnlocking(false); }
            }, 30);
          };
          const onUnlockAll = () => runUnlock(true);
          const onUnlockFreeRoam = () => runUnlock(false);
          const revertAll = () => {
            try {
              const save = SaveFile.load(l.originalBytes);
              setLoaded({ fileName: l.fileName, save, originalBytes: l.originalBytes, fields: save.fields(), enums: save.enums(), observed: save.observedEnums(), collPresent: new Set(save.enumArrayEntries().map((e) => e.tag)) });
              setUnlockResult(null);
              setError(null);
            } catch (e) { onErr(e); }
          };
          const setDifficulty = (member: string) => {
            const diffs = l.enums.filter((e) => e.enumType === "EDifficultySetting");
            if (diffs.length) onEnumBulk(diffs, member);
          };
          const currentDifficulty = l.enums.find((e) => e.enumType === "EDifficultySetting")?.member;
          const backupOriginal = () => downloadBytes(l.fileName.startsWith("BackupCopy_") ? l.fileName : `ORIGINAL_${l.fileName}`, l.originalBytes);

          const downloadBar = <DownloadBar save={l.save} fileName={l.fileName} onReset={() => setLoaded(null)} />;
          const downgrade = <DowngradePanel save={l.save} onApplied={() => { refreshFields(); rerender(); }} />;
          const missions = <MissionsPanel enums={l.enums} present={l.collPresent} observed={l.observed} onChange={onEnumChange} onAdd={onAddEntries} onCompleteMany={onCompleteMany} />;
          const collectibles = <CollectiblesPanel collectibles={COLLECTIBLES} present={l.collPresent} onAdd={onCollAdd} />;
          const back = <button className="ghost backLink" onClick={() => setMode("choose")}>← What do you want to do?</button>;

          return (
            <>
              <section className="card statusBar">
                <span className="badge ok">✓ valid save</span>
                <span className="statusInfo">{comp.have}/{comp.total} collectibles · {comp.pct}%</span>
                <div className="statusActions">
                  <button className="ghost" onClick={backupOriginal}>⬇ Back up my original</button>
                  <button className="ghost" onClick={revertAll} title="Discard every edit and reload the save as you first opened it">↺ Revert all changes</button>
                </div>
              </section>

              {mode === "choose" && (
                <section className="card chooser">
                  <h2>What do you want to do?</h2>
                  <p className="hint">Pick a goal — switch any time. Nothing changes your real save until you download.</p>
                  <div className="chooserGrid">
                    <button className="chooseCard" onClick={() => setMode("fix")}>
                      <span className="ci">🔧</span><b>Fix my save</b>
                      <span>It won't load, or "created on an updated version of the game"</span>
                    </button>
                    <button className="chooseCard" onClick={() => setMode("unlock")}>
                      <span className="ci">⭐</span><b>Unlock &amp; complete everything</b>
                      <span>One click — max studs, all collectibles, everything done</span>
                    </button>
                    <button className="chooseCard" onClick={() => setMode("fill")}>
                      <span className="ci">🎯</span><b>Fill in what I'm missing</b>
                      <span>See how complete you are, then add specific things</span>
                    </button>
                    <button className="chooseCard" onClick={() => setMode("edit")}>
                      <span className="ci">⚙️</span><b>Edit anything</b>
                      <span>Every field &amp; setting — for power users</span>
                    </button>
                  </div>
                </section>
              )}

              {mode === "fix" && (<>{back}<FixMySaveHelp valid />{downgrade}{downloadBar}</>)}

              {mode === "unlock" && (
                <>
                  {back}
                  <UnlockEverythingPanel onRun={onUnlockAll} onRunFreeRoam={onUnlockFreeRoam} running={unlocking} result={unlockResult} />
                  <QuickUnlock collectibles={COLLECTIBLES} present={l.collPresent} onAdd={onCollAdd} />
                  {downloadBar}
                </>
              )}

              {mode === "fill" && (<>{back}<CompletionOverview collectibles={COLLECTIBLES} present={l.collPresent} />{collectibles}{missions}{downloadBar}</>)}

              {mode === "edit" && (
                <>
                  {back}
                  <section className="card meta">
                    <div className="metaRow"><span className="k">File</span><span className="v mono">{l.fileName}</span></div>
                    <div className="metaRow"><span className="k">Class</span><span className="v mono">{l.save.doc.header.saveGameClassName}</span></div>
                    <div className="metaRow"><span className="k">Engine</span><span className="v mono">{l.save.doc.header.engineMajor}.{l.save.doc.header.engineMinor}.{l.save.doc.header.enginePatch} ({l.save.doc.header.branch})</span></div>
                    <div className="metaRow"><span className="k">Build version</span><span className="v mono">{buildVersion ?? "—"}</span></div>
                  </section>
                  <QuickEdits fields={l.fields} onEdit={onQuickEdit} />
                  {currentDifficulty && (
                    <section className="card">
                      <h2>Difficulty</h2>
                      <p className="hint">Make the game easier or harder. (Currently: {currentDifficulty})</p>
                      <div className="presetRow">
                        {[...new Set(["Normal", "Medium", "Hard", currentDifficulty])].map((d) => (
                          <button key={d} className={currentDifficulty === d ? "chip on" : "chip"} onClick={() => setDifficulty(d)}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  {downgrade}
                  <EnumPanel enums={l.enums} observed={l.observed} onChange={onEnumChange} onBulk={onEnumBulk} onCompleteAll={onCompleteAll} />
                  {missions}
                  {collectibles}
                  <details className="card advanced">
                    <summary>
                      <h2>Advanced: all raw fields</h2>
                      <span className="advHint">Every value in the save, by name. For power users.</span>
                    </summary>
                    <FieldTable fields={l.fields} onEdit={onFieldEdit} />
                  </details>
                  {downloadBar}
                </>
              )}
            </>
          );
        })()}

      <footer className="foot">
        <a href="https://github.com/fisherjoey/tt-save-editor" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
        <span> · Edits your own saves only · Not affiliated with WB / TT Games · MIT</span>
      </footer>
    </div>
  );
}

function DowngradePanel({ save, onApplied }: { save: SaveFile; onApplied: () => void }) {
  const current = readBuildVersion(save);
  const [target, setTarget] = useState<string>("");
  const [refName, setRefName] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const readFromReference = (bytes: Uint8Array, name: string) => {
    try {
      const sf = SaveFile.load(bytes);
      const bv = readBuildVersion(sf);
      if (bv === undefined) throw new Error("no BuildVersion in that save");
      setTarget(String(bv));
      setRefName(name);
      setMsg(`Read build ${bv} from ${name}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card downgrade">
      <h2>Make this save load on an older patch</h2>
      <p className="hint">
        {downgradeRecipe.description} Current build: <span className="mono">{current ?? "—"}</span>.
      </p>
      <div className="row">
        <label>
          Target build version
          <input className="mono" inputMode="numeric" value={target} placeholder="e.g. 1281204" onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="refpick">
          …or read it from a save made on that build
          <input
            type="file"
            accept=".sav"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) readFromReference(new Uint8Array(await f.arrayBuffer()), f.name);
            }}
          />
        </label>
      </div>
      {refName && <p className="hint mono">reference: {refName}</p>}
      <button
        className="primary"
        disabled={!/^\d+$/.test(target)}
        onClick={() => {
          try {
            downgradeRecipe.apply(save, { targetBuildVersion: Number(target) });
            setMsg(`Build version set to ${target}. Download below and load it on the older build.`);
            onApplied();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Apply downgrade
      </button>
      {msg && <p className="ok">{msg}</p>}
    </section>
  );
}

function DownloadBar({ save, fileName, onReset }: { save: SaveFile; fileName: string; onReset: () => void }) {
  const backupName = useMemo(() => (fileName.startsWith("BackupCopy_") ? fileName : `BackupCopy_${fileName}`), [fileName]);
  const download = (name: string, bytes: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="card downloadbar">
      <div>
        <h2>Download</h2>
        <p className="hint">Save both files into your game’s SaveGames folder (replace the originals — back them up first). The game cross-checks the pair.</p>
      </div>
      <div className="dlbtns">
        <button className="primary" onClick={() => download(fileName, save.toBytes())}>
          ⬇ {fileName}
        </button>
        <button className="primary" onClick={() => download(backupName, save.backupBytes())}>
          ⬇ {backupName}
        </button>
        <button className="ghost" onClick={onReset}>
          Open another save
        </button>
      </div>
    </section>
  );
}
