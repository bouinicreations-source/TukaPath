import { useState, useEffect } from "react";
import { base44 } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronUp, Search } from "lucide-react";

const STATUS_COLORS = {
  complete:      "bg-green-100 text-green-700",
  partial:       "bg-amber-100 text-amber-700",
  arrival_only:  "bg-sky-100 text-sky-700",
  empty:         "bg-red-100 text-red-700",
};

function formatTime(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Summary row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[log.result_status] || "bg-muted text-muted-foreground"}`}>
              {log.result_status}
            </span>
            <span className="text-xs text-muted-foreground">{formatTime(log.created_date)}</span>
            {log.mode && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{log.mode}</span>}
          </div>

          {/* Route line */}
          <p className="text-sm font-medium truncate">
            {log.origin_name || "?"} → {log.destination_name || "loop"}
          </p>

          {/* Raw input */}
          {log.raw_input && (
            <p className="text-xs text-muted-foreground italic mt-0.5 truncate">"{log.raw_input}"</p>
          )}

          {/* Pill stats */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded">bbox: {log.bbox_candidates ?? "-"}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded">corridor: {log.corridor_candidates ?? "-"}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded">eligible: {log.eligible_candidates ?? "-"}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded">stops: {log.final_stop_count ?? 0}</span>
            {log.route_distance_km && (
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded">{Math.round(log.route_distance_km)}km</span>
            )}
          </div>
        </div>
        <button className="flex-shrink-0 mt-1 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-3">

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Origin</p>
              <p>{log.origin_name}</p>
              {log.origin_lat && <p className="text-muted-foreground">{log.origin_lat?.toFixed(4)}, {log.origin_lng?.toFixed(4)}</p>}
              {log.origin_confidence && <p className="text-muted-foreground">confidence: {(log.origin_confidence * 100).toFixed(0)}%</p>}
              {log.fuzzy_origin_match && <p className="text-primary">fuzzy: {log.fuzzy_origin_match}</p>}
            </div>
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Destination</p>
              <p>{log.destination_name || "—"}</p>
              {log.destination_lat && <p className="text-muted-foreground">{log.destination_lat?.toFixed(4)}, {log.destination_lng?.toFixed(4)}</p>}
              {log.dest_confidence && <p className="text-muted-foreground">confidence: {(log.dest_confidence * 100).toFixed(0)}%</p>}
              {log.fuzzy_dest_match && <p className="text-primary">fuzzy: {log.fuzzy_dest_match}</p>}
            </div>
          </div>

          {/* Intent + time */}
          <div className="text-xs space-y-1">
            {log.intent_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {log.intent_tags.map(t => <span key={t} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
            {log.time_mode && (
              <p className="text-muted-foreground">Time: {log.time_mode}{log.time_minutes ? ` · ${log.time_minutes}min` : ""}</p>
            )}
          </div>

          {/* Pipeline counts */}
          <div className="text-xs grid grid-cols-3 gap-2">
            {[
              ["bbox_candidates", log.bbox_candidates],
              ["corridor", log.corridor_candidates],
              ["eligible", log.eligible_candidates],
              ["rej zone", log.rejected_by_zone],
              ["rej detour", log.rejected_by_detour],
              ["rej dir", log.rejected_by_direction],
              ["purged orig", log.origin_zone_purged],
            ].map(([label, val]) => (
              <div key={label} className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="font-bold text-sm">{val ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* Final stops */}
          {log.final_stop_names?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Stops</p>
              <div className="flex flex-wrap gap-1">
                {log.final_stop_names.map((n, i) => <span key={i} className="text-xs bg-card border border-border px-2 py-0.5 rounded-lg">{n}</span>)}
              </div>
            </div>
          )}

          {/* Arrival suggestions */}
          {log.arrival_suggestion_names?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Arrival Suggestions</p>
              <div className="flex flex-wrap gap-1">
                {log.arrival_suggestion_names.map((n, i) => <span key={i} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-lg">{n}</span>)}
              </div>
            </div>
          )}

          {/* GPT parse result */}
          {log.parse_gpt_result && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">GPT Parse</p>
              <pre className="text-[10px] bg-muted rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {(() => { try { return JSON.stringify(JSON.parse(log.parse_gpt_result), null, 2); } catch { return log.parse_gpt_result; } })()}
              </pre>
            </div>
          )}

          {/* Validation notes */}
          {log.validation_notes && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
              <p className="font-semibold text-amber-800">Validation</p>
              <p className="text-amber-700 mt-0.5">{log.validation_notes}</p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">Route: {log.route_provider} · {log.blueprint_key}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminJourneyLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.JourneyDebugLog.list("-created_date", 100);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const matchSearch = !search || [l.raw_input, l.origin_name, l.destination_name].some(s => s?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || l.result_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Journey Debug Logs</h2>
          <p className="text-xs text-muted-foreground">{logs.length} recent requests · pipeline telemetry</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-lg gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search input, origin, destination…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:border-primary/40"
          />
        </div>
        {["all", "complete", "partial", "arrival_only", "empty"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No journey logs yet.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}