import { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { ChevronDown, ChevronUp, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLORS = {
  complete:     "bg-green-100 text-green-700",
  partial:      "bg-amber-100 text-amber-700",
  arrival_only: "bg-sky-100 text-sky-700",
  empty:        "bg-slate-100 text-slate-500",
  failed:       "bg-red-100 text-red-700",
};

function JsonBlock({ data }) {
  if (!data) return <span className="text-muted-foreground text-[11px]">—</span>;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="bg-slate-950 text-slate-200 text-[10px] rounded-lg p-3 overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">
      {str}
    </pre>
  );
}

function RequestRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  let parsed = null;
  try { parsed = log.parsed_preferences ? JSON.parse(log.parsed_preferences) : null; } catch {}

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[log.result_status] || "bg-muted text-muted-foreground"}`}>
              {log.result_status || "unknown"}
            </span>
            <span className="text-[10px] text-muted-foreground">{log.mode || "—"}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(log.created_date)}</span>
          </div>
          <div className="text-xs font-semibold truncate">
            {log.origin_text || "?"} → {log.destination_text || "loop"}
          </div>
          {log.raw_prompt && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">"{log.raw_prompt}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <span className="text-[11px] text-muted-foreground">{log.generated_stops_count ?? "—"} stops</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded debug detail */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Origin</p>
              <p>{log.origin_text || "—"}</p>
              {log.origin_lat && <p className="text-[10px] text-muted-foreground">{log.origin_lat?.toFixed(4)}, {log.origin_lng?.toFixed(4)}</p>}
            </div>
            <div>
              <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Destination</p>
              <p>{log.destination_text || "loop"}</p>
              {log.destination_lat && <p className="text-[10px] text-muted-foreground">{log.destination_lat?.toFixed(4)}, {log.destination_lng?.toFixed(4)}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-[10px] text-muted-foreground">Mode</p><p className="font-medium">{log.mode || "—"}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Time</p><p className="font-medium">{log.time_minutes ? `${log.time_minutes} min` : "—"}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Route</p><p className="font-medium">{log.route_style || "—"}</p></div>
          </div>

          {/* Themes */}
          {log.themes?.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Themes</p>
              <div className="flex flex-wrap gap-1">
                {log.themes.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Parsed preferences (debug JSON from buildJourneyV2) */}
          {parsed && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Debug Layers</p>

              {/* Candidate counts */}
              {parsed.total_candidates_loaded !== undefined && (
                <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-center">
                  {[
                    { label: "Loaded", val: parsed.total_candidates_loaded },
                    { label: "Corridor", val: parsed.corridor_candidates_count },
                    { label: "Eligible", val: parsed.corridor_eligible },
                    { label: "Scored", val: parsed.scored_count },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-card border border-border rounded-lg p-2">
                      <p className="font-bold text-sm">{val ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Arrival debug */}
              {parsed.arrival_debug && (
                <div className="mb-3 p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs">
                  <p className="font-semibold text-sky-800 mb-1">Arrival Suggestions Debug</p>
                  <p><span className="text-muted-foreground">Dest type:</span> {parsed.arrival_debug.destination_type}</p>
                  <p><span className="text-muted-foreground">Zone radius:</span> {parsed.arrival_debug.destination_zone_radius_km} km</p>
                  <p><span className="text-muted-foreground">Candidates:</span> {parsed.arrival_debug.destination_candidate_names?.join(", ") || "none"}</p>
                  <p><span className="text-muted-foreground">Final:</span> {parsed.arrival_debug.final_arrival_names?.join(", ") || "none"}</p>
                </div>
              )}

              {/* L8 validation */}
              {parsed.l8_validation && (
                <div className="mb-3 p-3 rounded-lg bg-muted border border-border text-xs">
                  <p className="font-semibold mb-1">L8 Validation</p>
                  <p>Stops before: {parsed.l8_validation.stops_before} → after: {parsed.l8_validation.stops_after}</p>
                  <p>Removed: {parsed.l8_validation.removed_count}</p>
                  <p>Status: {parsed.l8_validation.result_reason}</p>
                </div>
              )}

              {/* Full raw debug */}
              <details>
                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground py-1">Full debug JSON</summary>
                <div className="mt-2"><JsonBlock data={parsed} /></div>
              </details>
            </div>
          )}

          {/* Failure reason */}
          {log.failure_reason && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[10px] font-semibold text-red-700 mb-1">Failure Reason</p>
              <p className="text-xs text-red-600">{log.failure_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminJourneyRequestLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.JourneyRequestLog.list("-created_date", 100);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const matchStatus = statusFilter === "all" || l.result_status === statusFilter;
    const matchSearch = !search || [l.origin_text, l.destination_text, l.raw_prompt].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Journey Request Log</h2>
          <p className="text-xs text-muted-foreground">{logs.length} recent requests</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="rounded-lg gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search origin, destination, prompt…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-card focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="flex gap-1">
          {["all", "complete", "partial", "arrival_only", "empty", "failed"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">No requests found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => <RequestRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}