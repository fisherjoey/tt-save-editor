export function UnlockEverythingPanel({
  onRun,
  running,
  result,
}: {
  onRun: () => void;
  running: boolean;
  result: { collectiblesAdded: number; progressCompleted: number; studsSet: number } | null;
}) {
  return (
    <section className="card">
      <h2>Unlock &amp; complete everything</h2>
      <p className="hint">
        One click does it all: maxes out your studs, adds every collectible (gold bricks, minikits, trophies,
        Wayne Tech chips, vehicles, costumes…), and marks all missions, challenges, and objectives complete.
      </p>

      <button className="primary unlockBig" disabled={running} onClick={onRun}>
        {running ? "Working…" : "⭐ Unlock & complete everything"}
      </button>

      <p className="reassure">
        Only gold bricks are confirmed in-game; the rest use the same mechanism. Your original is backed up — try it
        and revert if anything looks off.
      </p>

      {result && (
        <p className="ok">
          ✓ Done — added {result.collectiblesAdded.toLocaleString()} collectibles, completed{" "}
          {result.progressCompleted.toLocaleString()} entries, studs set to {result.studsSet.toLocaleString()}.
          Download below to use it.
        </p>
      )}
    </section>
  );
}
