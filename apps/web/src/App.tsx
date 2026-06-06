import { useCallback, useEffect, useMemo, useState } from "react";
import { SaveFile, readBuildVersion, downgradeRecipe, FEATURED_FIELDS, fromDisplay, COLLECTIBLES, type ScalarField, type EnumField } from "@tt-save/core";
import { Dropzone } from "./components/Dropzone.js";
import { FieldTable } from "./components/FieldTable.js";
import { EnumPanel } from "./components/EnumPanel.js";
import { QuickEdits } from "./components/QuickEdits.js";
import { CollectiblesPanel } from "./components/CollectiblesPanel.js";
import { Help } from "./components/Help.js";

interface Loaded {
  fileName: string;
  save: SaveFile;
  fields: ScalarField[];
  enums: EnumField[];
  observed: Map<string, Set<string>>;
  collPresent: Set<string>;
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const onFile = useCallback((name: string, bytes: Uint8Array) => {
    setError(null);
    try {
      const save = SaveFile.load(bytes);
      setLoaded({
        fileName: name,
        save,
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
      {error && <div className="banner err">Couldn’t open that save: {error}</div>}

      {loaded && (
        <>
          <section className="card meta">
            <div className="metaRow">
              <span className="k">File</span>
              <span className="v mono">{loaded.fileName}</span>
            </div>
            <div className="metaRow">
              <span className="k">Class</span>
              <span className="v mono">{loaded.save.doc.header.saveGameClassName}</span>
            </div>
            <div className="metaRow">
              <span className="k">Engine</span>
              <span className="v mono">
                {loaded.save.doc.header.engineMajor}.{loaded.save.doc.header.engineMinor}.{loaded.save.doc.header.enginePatch} ({loaded.save.doc.header.branch})
              </span>
            </div>
            <div className="metaRow">
              <span className="k">Build version</span>
              <span className="v mono">{buildVersion ?? "—"}</span>
            </div>
          </section>

          <QuickEdits
            fields={loaded.fields}
            onEdit={(name, value) => {
              try {
                const f = loaded.fields.find((x) => x.name === name);
                const meta = FEATURED_FIELDS.find((x) => x.name === name);
                // Apply any unit conversion (e.g. minutes → 100ns ticks for Timespan).
                const raw = meta?.unit ? fromDisplay(value, meta.unit) : value;
                const v = f?.type === "Int64Property" || f?.type === "UInt64Property" ? (typeof raw === "bigint" ? raw : BigInt(raw as number | string)) : Number(raw);
                // Apply to the primary field AND every linked field, so denormalized copies stay in sync.
                loaded.save.setFieldAll(name, v);
                for (const ln of meta?.linkedNames ?? []) loaded.save.setFieldAll(ln, v);
                refreshFields();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />

          <DowngradePanel
            save={loaded.save}
            onApplied={() => {
              refreshFields();
              rerender();
            }}
          />

          <EnumPanel
            enums={loaded.enums}
            observed={loaded.observed}
            onChange={(field, member) => {
              try {
                loaded.save.setEnum(field, member);
                refreshFields();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
            onBulk={(fields, member) => {
              try {
                loaded.save.setEnumsBulk(fields, member);
                refreshFields();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
            onCompleteAll={() => {
              try {
                loaded.save.completeAllProgress();
                refreshFields();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />

          <CollectiblesPanel
            collectibles={COLLECTIBLES}
            present={loaded.collPresent}
            onAdd={(items) => {
              try {
                const byState = new Map<string, string[]>();
                for (const it of items) {
                  if (!byState.has(it.stateValue)) byState.set(it.stateValue, []);
                  byState.get(it.stateValue)!.push(it.tag);
                }
                for (const [state, tags] of byState) loaded.save.addCollectibles(tags, state);
                refreshFields();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />

          <details className="card advanced">
            <summary>
              <h2>Advanced: all raw fields</h2>
              <span className="advHint">Every value in the save, by name. For power users.</span>
            </summary>
            <FieldTable
              fields={loaded.fields}
              onEdit={(field, value) => {
                try {
                  loaded.save.setField(field.name, value);
                  refreshFields();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          </details>

          <DownloadBar save={loaded.save} fileName={loaded.fileName} onReset={() => setLoaded(null)} />
        </>
      )}

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
