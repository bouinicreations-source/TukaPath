/**
 * CoverageTab
 *
 * Shows the result of recent minimal coverage ingestion (GeneratedLocationLog).
 * States: saved (ready), needs_review, duplicate (hard/soft), failed.
 * No processing queue — records are saved immediately by the new flow.
 */

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle, XCircle, AlertTriangle, Clock, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getLogDisplayStatus(log) {
  if (log.generation_status === "ready") {
    if (log.error_message?.startsWith("Soft duplicate")) return "needs_review";
    return "saved";
  }
  if (log.generation_status === "failed") {
    if (log.reused_existing || log.error_message?.includes("Hard duplicate")) return "blocked";
    return "failed";
  }
  if (log.generation_status === "processing") return "processing";
  return "unknown";
}

const STATUS_CONFIG = {
  saved:       { label: "Saved",           dot: "bg-green-500",  text: "text-green-700 bg-green-50",  Icon: CheckCircle },
  needs_review:{ label: "Needs Review",    dot: "bg-amber-500",  text: "text-amber-700 bg-amber-50",  Icon: AlertTriangle },
  blocked:     { label: "Duplicate",       dot: "bg-slate-400",  text: "text-slate-600 bg-slate-100", Icon: XCircle },
  failed:      { label: "Failed",          dot: "bg-red-500",    text: "text-red-700 bg-red-50",      Icon: XCircle },
  processing:  { label: "Processing…",    dot: "bg-blue-400",   text: "text-blue-700 bg-blue-50",    Icon: Clock },
  unknown:     { label: "Unknown",         dot: "bg-muted",      text: "text-muted-foreground bg-muted", Icon: Clock },
};

function LogRow({ log, onDelete }) {
  const status = getLogDisplayStatus(log);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = cfg.Icon;

  // Extract existing Location ID from error message for duplicates
  const existingLocationId = status === "blocked" ? (log.location_id || null) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.text.split(" ")[0]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{log.location_name || log.request_text || "—"}</p>
        <p className="text-xs text-muted-foreground">
          {log.city}{log.country ? `, ${log.country}` : ""} · {formatDate(log.created_date)}
        </p>
        {status === "blocked" && existingLocationId && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            ↳ Already saved in Locations:{" "}
            <span className="font-mono bg-slate-100 px-1 rounded">{existingLocationId}</span>
          </p>
        )}
        {status === "blocked" && !existingLocationId && (
          <p className="text-[10px] text-slate-500 mt-0.5">↳ Already exists in saved Locations</p>
        )}
        {status === "failed" && log.error_message && (
          <p className="text-[10px] text-red-600 mt-0.5 truncate">{log.error_message}</p>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
      <button
        onClick={() => onDelete(log)}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        title="Remove log entry"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BatchGroup({ batchId, logs, onDelete }) {
  const [open, setOpen] = useState(true);
  const saved      = logs.filter(l => getLogDisplayStatus(l) === "saved").length;
  const review     = logs.filter(l => getLogDisplayStatus(l) === "needs_review").length;
  const blocked    = logs.filter(l => getLogDisplayStatus(l) === "blocked").length;
  const failed     = logs.filter(l => getLogDisplayStatus(l) === "failed").length;
  const processing = logs.filter(l => getLogDisplayStatus(l) === "processing").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div>
          <p className="text-xs font-mono text-muted-foreground">{batchId}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {saved > 0      && <span className="text-[10px] font-semibold text-green-700">{saved} saved</span>}
            {review > 0     && <span className="text-[10px] font-semibold text-amber-700">{review} needs review</span>}
            {blocked > 0    && <span className="text-[10px] font-semibold text-slate-500">{blocked} duplicate</span>}
            {failed > 0     && <span className="text-[10px] font-semibold text-red-600">{failed} failed</span>}
            {processing > 0 && <span className="text-[10px] font-semibold text-blue-600">{processing} processing</span>}
          </div>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-border/40">
          {logs.map(log => <LogRow key={log.id} log={log} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

export default function CoverageTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clearingStale, setClearingStale] = useState(false);

  const { data: allLogs = [], isLoading, refetch } = useQuery({
    queryKey: ["coverage-logs"],
    queryFn: () => base44.entities.GeneratedLocationLog.list("-created_date", 500),
    refetchInterval: 15000,
  });

  const handleDeleteLog = async (log) => {
    if (!confirm(`Remove log entry for "${log.location_name || log.request_text}"? This does NOT delete the saved Location record.`)) return;
    await base44.entities.GeneratedLocationLog.delete(log.id);
    qc.invalidateQueries({ queryKey: ["coverage-logs"] });
    toast.success("Log entry removed");
  };

  const handleClearStaleProcessing = async () => {
    const stale = allLogs.filter(l => l.generation_status === "processing");
    if (!stale.length) { toast.info("No stale processing items found"); return; }
    if (!confirm(`Clear ${stale.length} stuck "processing" log entries? This does NOT delete any saved Location records.`)) return;
    setClearingStale(true);
    await Promise.all(stale.map(l =>
      base44.entities.GeneratedLocationLog.update(l.id, {
        generation_status: "failed",
        error_message: "Cleared by admin — old queue item",
      })
    ));
    qc.invalidateQueries({ queryKey: ["coverage-logs"] });
    toast.success(`Cleared ${stale.length} stale items`);
    setClearingStale(false);
  };

  // Filter logs
  const filtered = allLogs.filter(log => {
    if (search) {
      const q = search.toLowerCase();
      if (!log.location_name?.toLowerCase().includes(q) && !log.city?.toLowerCase().includes(q) && !log.country?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all") {
      if (getLogDisplayStatus(log) !== statusFilter) return false;
    }
    return true;
  });

  // Group by batch_id
  const batchMap = {};
  for (const log of filtered) {
    const key = log.batch_id || `single-${log.id}`;
    if (!batchMap[key]) batchMap[key] = [];
    batchMap[key].push(log);
  }
  const batches = Object.entries(batchMap).sort(([, a], [, b]) =>
    new Date(b[0]?.created_date || 0) - new Date(a[0]?.created_date || 0)
  );

  const staleCount = allLogs.filter(l => l.generation_status === "processing").length;
  const savedCount = allLogs.filter(l => getLogDisplayStatus(l) === "saved").length;
  const reviewCount = allLogs.filter(l => getLogDisplayStatus(l) === "needs_review").length;
  const failedCount = allLogs.filter(l => getLogDisplayStatus(l) === "failed").length;
  const blockedCount = allLogs.filter(l => getLogDisplayStatus(l) === "blocked").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="text-green-700 font-semibold">{savedCount} saved</span>
        <span className="text-amber-700 font-semibold">{reviewCount} needs review</span>
        <span className="text-slate-500">{blockedCount} duplicate blocked</span>
        {failedCount > 0 && <span className="text-red-600 font-semibold">{failedCount} failed</span>}
        {staleCount > 0 && <span className="text-blue-600 font-semibold">{staleCount} still processing (old queue)</span>}
      </div>

      {/* Stale warning + clear button */}
      {staleCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{staleCount} item{staleCount !== 1 ? "s" : ""} still stuck in "processing" from old queue. Safe to clear.</span>
          <Button
            size="sm" variant="outline"
            onClick={handleClearStaleProcessing}
            disabled={clearingStale}
            className="text-amber-700 border-amber-300 hover:bg-amber-100 text-[11px]"
          >
            {clearingStale ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Clearing…</> : "Clear Stale"}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-9 h-8 text-sm" />
        </div>
        {[
          { key: "all",          label: "All" },
          { key: "saved",        label: "Saved" },
          { key: "needs_review", label: "Needs Review" },
          { key: "blocked",      label: "Duplicate" },
          { key: "failed",       label: "Failed" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${statusFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : batches.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No coverage log entries yet.</div>
      ) : (
        <div className="space-y-3">
          {batches.map(([batchId, logs]) => (
            <BatchGroup key={batchId} batchId={batchId} logs={logs} onDelete={handleDeleteLog} />
          ))}
        </div>
      )}
    </div>
  );
}