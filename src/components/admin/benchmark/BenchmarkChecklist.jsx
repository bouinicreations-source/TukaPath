export default function BenchmarkChecklist({ checks }) {
  if (!checks) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detailed Checks</p>
      {Object.values(checks).map((check, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${check.pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {check.pass ? "PASS" : "FAIL"}
          </span>
          <div>
            <span className="text-xs font-semibold">{check.label}</span>
            {check.notes?.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {check.notes.map((n, j) => (
                  <p key={j} className={`text-[11px] font-mono ${check.pass ? "text-muted-foreground" : "text-amber-700"}`}>{n}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}