export function UnlockEverythingPanel({
  onRun,
  onRunFreeRoam,
  running,
  result,
}: {
  onRun: () => void;
  /** Unlock everything but DON'T mark the story complete (keeps it playable). */
  onRunFreeRoam: () => void;
  running: boolean;
  result: { collectiblesAdded: number; progressCompleted: number; studsSet: number } | null;
}) {
  return (
    <section className="card">
      <h2>Unlock &amp; complete everything</h2>
      <p className="hint">
        One click does it all: maxes out your studs, adds every collectible (gold bricks, Riddler trophies, MicroBuilds,
        WayneTech chips, vehicles, costumes…), and marks all missions, challenges, and objectives complete.
      </p>

      <button className="primary unlockBig" disabled={running} onClick={onRun}>
        {running ? "Working…" : "⭐ Unlock everything AND mark the story finished (100%)"}
      </button>

      <button className="ghost freeRoamBtn" disabled={running} onClick={onRunFreeRoam}>
        🦇 Unlock everything but leave the story unplayed (so you can still play through the missions)
      </button>

      <p className="reassure">
        We've confirmed gold bricks work in the game. Everything else is added the same way and should work too, but we
        haven't tested every type — if something looks off, use <b>Revert all changes</b> (or back up your original
        first).
      </p>

      {result && (
        <p className="ok">
          ✓ Done — added every collectible we know about, marked all missions, objectives and challenges complete, and
          maxed out your studs ({result.studsSet.toLocaleString()}). Download below to use it.
        </p>
      )}
    </section>
  );
}
