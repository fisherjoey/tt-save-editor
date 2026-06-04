import { useCallback, useEffect, useMemo, useState } from "react";
import { Keystream, SaveFile, readBuildVersion, downgradeRecipe, type ScalarField, type EnumField } from "@tt-save/core";
import { Dropzone } from "./components/Dropzone.js";
import { FieldTable } from "./components/FieldTable.js";
import { EnumPanel } from "./components/EnumPanel.js";
import { Help } from "./components/Help.js";

interface Loaded {
  fileName: string;
  save: SaveFile;
  cipherLen: number;
  fields: ScalarField[];
  enums: EnumField[];
  observed: Map<string, Set<string>>;
}

export function App() {
  const [ks, setKs] = useState<Keystream | null>(null);
  const [ksError, setKsError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  // Load the bundled universal keystream once.
  useEffect(() => {
    fetch("/keystream.bin")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const k = new Keystream(new Uint8Array(buf));
        if (!k.isValid()) throw new Error("bundled keystream failed its sanity check");
        setKs(k);
      })
      .catch((e) => setKsError(String(e)));
  }, []);

  const onFile = useCallback(
    (name: string, bytes: Uint8Array) => {
      setError(null);
      if (!ks) return;
      try {
        const save = SaveFile.load(bytes, ks);
        setLoaded({ fileName: name, save, cipherLen: bytes.length, fields: save.fields(), enums: save.enums(), observed: save.observedEnums() });
      } catch (e) {
        setLoaded(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [ks],
  );

  const refreshFields = useCallback(() => {
    setLoaded((l) => (l ? { ...l, fields: l.save.fields(), enums: l.save.enums(), observed: l.save.observedEnums() } : l));
  }, []);

  const loadSample = useCallback(async () => {
    const buf = await fetch("/sample.sav").then((r) => r.arrayBuffer());
    onFile("SaveSlot_0_TT.sav", new Uint8Array(buf));
  }, [onFile]);

  const padCovers = loaded ? loaded.cipherLen <= (ks?.length ?? 0) : true;
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

      {ksError && <div className="banner err">Could not load the keystream: {ksError}</div>}

      {!loaded && (
        <>
          <Dropzone disabled={!ks} onFile={onFile} />
          <p className="sampleLine">
            No save handy? <button className="link" disabled={!ks} onClick={loadSample}>Try a sample save</button> — edit and download it to see how it works.
          </p>
        </>
      )}
      {error && <div className="banner err">Couldn’t open that save: {error}</div>}

      {loaded && ks && (
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
            {!padCovers && (
              <div className="banner warn">
                This save ({(loaded.cipherLen / 1024).toFixed(0)} KB) is larger than the bundled keystream ({((ks.length || 0) / 1024).toFixed(0)} KB). Header
                edits and the downgrade still work, but fields past the covered region are hidden until a longer keystream is loaded.
              </div>
            )}
          </section>

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
    // We can't know the user's keystream here; reuse the same bundled one via a throwaway load.
    try {
      // Reference saves share the universal pad, so the bundled keystream reads them too.
      const ref = (save as unknown as { keystream: Keystream }).keystream;
      const sf = SaveFile.load(bytes, ref);
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
