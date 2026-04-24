import { useState } from "react";

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/70">{title}</span>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function JsonBlock({ data }) {
  return (
    <pre className="text-[10px] font-mono bg-slate-950 text-slate-200 rounded-lg p-3 overflow-auto max-h-56 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function BenchmarkDebugPanels({ result }) {
  const d = result.debug_summary || {};
  const jo = result.journey_output || {};

  return (
    <div className="space-y-2">

      {/* Final output */}
      <Collapsible title={`Final Stops — ${result.main_count}m + ${result.quick_count}q`} defaultOpen>
        <div className="space-y-3">
          {jo.main_stops?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Main Stops</p>
              <div className="space-y-1">
                {jo.main_stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground w-8">{s.progress?.toFixed(2)}</span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-primary/70 text-[10px] px-1.5 py-0.5 rounded bg-primary/10">{s.role}</span>
                    <span className="text-muted-foreground">score:{s.score}</span>
                    {s.route_label && s.route_label !== "On route" && (
                      <span className="text-amber-600 text-[10px]">{s.route_label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {jo.quick_stops?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Quick Stops</p>
              <div className="space-y-1">
                {jo.quick_stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground w-8">{s.progress?.toFixed(2)}</span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-slate-500 text-[10px] px-1.5 py-0.5 rounded bg-slate-100">{s.role}</span>
                    <span className="text-muted-foreground">score:{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {jo.arrival_suggestions?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Arrival Suggestions</p>
              <div className="flex flex-wrap gap-1">
                {jo.arrival_suggestions.map((n, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{n}</span>
                ))}
              </div>
            </div>
          )}
          {jo.main_stops?.length === 0 && jo.quick_stops?.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No route stops</p>
          )}
          {jo.journey_title && (
            <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-bold">{jo.journey_title}</p>
              {jo.mood && <p className="text-[10px] text-muted-foreground capitalize">Mood: {jo.mood}</p>}
              {jo.summary && <p className="text-[11px] text-foreground/60 mt-1 leading-relaxed">{jo.summary}</p>}
            </div>
          )}
        </div>
      </Collapsible>

      {/* L8 Validation */}
      {d.l8_validation && (
        <Collapsible title={`L8 Validation — ${d.l8_status || '—'}`}>
          <div className="space-y-2">
            <div className="flex gap-4 text-xs flex-wrap">
              <span>Before: <strong>{d.l8_validation.stops_before}</strong></span>
              <span>After: <strong>{d.l8_validation.stops_after}</strong></span>
              <span>Removed: <strong>{d.l8_validation.removed_count}</strong></span>
              <span>Mode: <strong>{d.l8_validation.route_mode_used}</strong></span>
            </div>
            {d.l8_validation.removed?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Removed</p>
                {d.l8_validation.removed.map((r, i) => (
                  <div key={i} className="text-[11px] font-mono text-destructive">{r.name}: {r.reason}</div>
                ))}
              </div>
            )}
            {d.l8_validation.credibility_flags?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Credibility Flags</p>
                {d.l8_validation.credibility_flags.map((f, i) => (
                  <div key={i} className={`text-[11px] font-mono ${f.fatal ? "text-destructive" : "text-amber-700"}`}>
                    {f.stop ? `${f.stop}: ` : ""}{f.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Top scored candidates */}
      {d.scored_top10?.length > 0 && (
        <Collapsible title={`Top Scored Candidates (${d.scored_top10.length})`}>
          <div className="overflow-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-2">Name</th>
                  <th className="text-right pb-2 pr-2">Score</th>
                  <th className="text-right pb-2 pr-2">Int</th>
                  <th className="text-right pb-2 pr-2">Pos</th>
                  <th className="text-right pb-2 pr-2">Flow</th>
                  <th className="text-right pb-2 pr-2">Prog</th>
                  <th className="text-left pb-2">Class</th>
                </tr>
              </thead>
              <tbody>
                {d.scored_top10.map((c, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-1.5 pr-2 font-semibold">{c.name}</td>
                    <td className="py-1.5 pr-2 text-right font-bold text-primary">{c.total_score}</td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">{c.intrinsic}</td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">{c.position}</td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">{c.flow}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{c.progress}</td>
                    <td className="py-1.5 text-[10px] text-muted-foreground">{c.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Penalties visible on hover — show inline if any */}
            {d.scored_top10.some(c => c.penalties?.length > 0) && (
              <div className="mt-2 space-y-0.5">
                {d.scored_top10.filter(c => c.penalties?.length > 0).map((c, i) => (
                  <div key={i} className="text-[10px] font-mono text-amber-700">{c.name}: {c.penalties.join(", ")}</div>
                ))}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Role assignment */}
      {d.l6_roles?.length > 0 && (
        <Collapsible title={`L6 Role Assignment (${d.l6_roles.length})`}>
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {d.l6_roles.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground w-8">{r.progress}</span>
                <span className="font-semibold w-40 truncate">{r.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{r.role}</span>
                <span className="text-muted-foreground">s:{r.score}</span>
                <span className={`text-[10px] ${r.confidence === "HIGH" ? "text-emerald-600" : r.confidence === "LOW" ? "text-red-500" : "text-amber-600"}`}>{r.confidence}</span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Rejected candidates */}
      {(d.l5_classified_reject_sample?.length > 0 || d.corridor_rejected > 0) && (
        <Collapsible title={`Rejected Candidates (corr: ${d.corridor_rejected} | L5: ${d.l5_classified_reject})`}>
          <div className="space-y-2">
            {d.corridor_rejected_sample?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Corridor Gate Rejects</p>
                <div className="space-y-0.5 max-h-32 overflow-auto">
                  {d.corridor_rejected_sample.map((r, i) => (
                    <div key={i} className="text-[11px] font-mono text-muted-foreground flex gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-amber-700">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {d.l5_classified_reject_sample?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Scoring Rejects (L5)</p>
                <div className="space-y-0.5 max-h-32 overflow-auto">
                  {d.l5_classified_reject_sample.map((r, i) => (
                    <div key={i} className="text-[11px] font-mono text-muted-foreground flex gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span>s:{r.score}</span>
                      <span className="text-red-600">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Compose trace */}
      {d.l7_compose_trace?.length > 0 && (
        <Collapsible title={`L7 Compose Trace (${d.l7_compose_trace.length} steps)`}>
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {d.l7_compose_trace.map((t, i) => (
              <div key={i} className="text-[11px] font-mono flex gap-2">
                <span className="text-muted-foreground flex-shrink-0">[{t.step}]</span>
                <span className="font-semibold">{t.name || "—"}</span>
                {t.role && <span className="text-primary/70">{t.role}</span>}
                <span className={t.reason?.startsWith("skip") || t.reason?.startsWith("§2") ? "text-amber-700" : "text-emerald-600"}>
                  {t.reason}
                </span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Route + pressure summary */}
      {(d.route || d.need_pressure) && (
        <Collapsible title="Route + Need Pressure">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {d.route && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Route</p>
                <p>Provider: <strong>{d.route.provider}</strong></p>
                <p>Distance: <strong>{d.route.distance_km}km</strong></p>
                <p>Duration: <strong>{d.route.duration_minutes}min</strong></p>
                <p>Blueprint: <strong>{d.blueprint}</strong></p>
                <p>Time constraint: <strong>{d.time_constraint}</strong></p>
              </div>
            )}
            {d.need_pressure && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Need Pressure</p>
                {Object.entries(d.need_pressure).map(([k, v]) => (
                  <p key={k}>{k.replace("_pressure", "")}: <strong className={v >= 70 ? "text-amber-600" : ""}>{v}</strong></p>
                ))}
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Field readiness */}
      {d.field_readiness?.proxy_usage_this_run && (
        <Collapsible title="Field Readiness — Proxy Audit">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Proxies Fired</p>
            {Object.keys(d.field_readiness.proxy_usage_this_run).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">None — all fields available</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(d.field_readiness.proxy_usage_this_run).map(([proxy, count]) => (
                  <span key={proxy} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono">
                    {proxy} ×{count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Collapsible>
      )}
    </div>
  );
}