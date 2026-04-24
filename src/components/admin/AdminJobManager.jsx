/**
 * AdminJobManager
 *
 * Displays all generation batch jobs grouped by batch_id.
 * Detects stale jobs (stuck processing > 10 min) and allows:
 * - Cancel stale/running jobs
 * - Retry failed/stale jobs
 * - Clear all stale jobs
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/client";
import {
  Loader2, AlertCircle, CheckCircle, XCircle, Clock,
  RefreshCw, Trash2, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getJobStatus(log) {
  if (log.generation_status === "ready") return "completed";
  if (log.generation_status === "failed") return "failed";
  if (log.generation_status === "processing") {
    const updatedAt = new Date(log.updated_date || log.created_date).getTime();
    const age = Date.now() - updatedAt;
    if (age > STALE_THRESHOLD_MS) return "stale";
    return "running";
  }
  return "unknown";
}

const STATUS_CONFIG = {
  running:   { label: "Running",   color: "text-blue-600",  bg: "bg-blue-50",  Icon: Loader2, spin: true },
  stale:     { label: "Stale",     color: "text-amber-600", bg: "bg-amber-50", Icon: AlertTriangle, spin: false },
  completed: { label: "Done",      color: "text-green-600", bg: "bg-green-50", Icon: CheckCircle, spin: false },
  failed:    { label: "Failed",    color: "text-red-600",   bg: "bg-red-50",   Icon: AlertCircle, spin: false },
  unknown:   { label: "Unknown",   color: "text-muted-foreground", bg: "bg-muted", Icon: Clock, spin: false },
};

function formatAge(isoDate) {
  if (!isoDate) return "—";
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function BatchJobGroup({ batchId, logs, onCancel, onRetry, cancelling, retrying }) {
  const [open, setOpen] = useState(true);

  const statusCounts = logs.reduce((acc, log) => {
    const s = getJobStatus(log);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const hasStale   = (statusCounts.stale || 0) > 0;
  const hasRunning = (statusCounts.running || 0) > 0;
  const hasFailed  = (statusCounts.failed || 0) > 0;
  const allDone    = logs.every(l => getJobStatus(l) === "completed");
  const createdDate = logs[0]?.created_date;

  return (
    <div className={`rounded-xl border overflow-hidden ${hasStale ? "border-amber-200" : allDone ? "border-green-200" : "border-border"}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{batchId}</span>
            {hasStale   && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{statusCounts.stale} stale</span>}
            {hasRunning && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{statusCounts.running} running</span>}
            {hasFailed  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{statusCounts.failed} failed</span>}
            {allDone    && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ complete</span>}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {logs.length} items · {statusCounts.completed || 0} done · started {formatAge(createdDate)}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/40">
          {logs.map(log => {
            const status = getJobStatus(log);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
            const Icon = cfg.Icon;
            const isStaleOrFailed = status === "stale" || status === "failed";
            const isRunningOrStale = status === "running" || status === "stale";

            return (
              <div key={log.id} className={`flex items-center gap-3 p-3 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color} ${cfg.spin ? "animate-spin" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.location_name || log.request_text || "—"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground">· updated {formatAge(log.updated_date || log.created_date)}</span>
                    {log.error_message && (
                      <span className="text-[10px] text-red-600 truncate max-w-[200px]">· {log.error_message}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {isRunningOrStale && (
                    <button
                      onClick={() => onCancel(log)}
                      disabled={cancelling.has(log.id)}
                      title="Cancel job"
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isStaleOrFailed && (
                    <button
                      onClick={() => onRetry(log)}
                      disabled={retrying.has(log.id)}
                      title="Retry job"
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retrying.has(log.id) ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminJobManager() {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(new Set());
  const [retrying, setRetrying]     = useState(new Set());

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ["job-manager-logs"],
    queryFn: () => base44.entities.GeneratedLocationLog.list("-created_date", 500),
    refetchInterval: 10000,
  });

  const updateLog = async (id, data) => {
    await base44.entities.GeneratedLocationLog.update(id, data);
    qc.invalidateQueries({ queryKey: ["job-manager-logs"] });
    qc.invalidateQueries({ queryKey: ["gen-logs-all"] });
  };

  const handleCancel = async (log) => {
    setCancelling(prev => new Set([...prev, log.id]));
    try {
      await updateLog(log.id, { generation_status: "failed", error_message: "Cancelled by admin" });
      toast.success(`Cancelled: ${log.location_name || log.request_text}`);
    } catch { toast.error("Cancel failed"); }
    setCancelling(prev => { const n = new Set(prev); n.delete(log.id); return n; });
  };

  const handleRetry = async (log) => {
    setRetrying(prev => new Set([...prev, log.id]));
    try {
      // Reset to processing so a new batch pick-up can occur
      await updateLog(log.id, {
        generation_status: "processing",
        error_message: null,
      });
      // Re-queue to background
      await base44.functions.invoke("startBackgroundGeneration", {
        items: [{
          place_id: log.google_place_id || null,
          payload: {
            name: log.location_name || log.request_text,
            city: log.city,
            country: log.country,
            category: "landmark",
            latitude: null,
            longitude: null,
          },
        }],
        batch_id: log.batch_id || `RETRY-${Date.now()}`,
        city: log.city,
        country: log.country,
      });
      toast.success(`Retrying: ${log.location_name || log.request_text}`);
    } catch (e) { toast.error("Retry failed: " + e.message); }
    setRetrying(prev => { const n = new Set(prev); n.delete(log.id); return n; });
  };

  const handleClearStale = async () => {
    const staleLogs = allLogs.filter(l => getJobStatus(l) === "stale");
    if (!staleLogs.length) { toast.info("No stale jobs found"); return; }
    if (!confirm(`Mark ${staleLogs.length} stale jobs as failed?`)) return;
    await Promise.all(staleLogs.map(l =>
      base44.entities.GeneratedLocationLog.update(l.id, { generation_status: "failed", error_message: "Auto-cleared stale job" })
    ));
    qc.invalidateQueries({ queryKey: ["job-manager-logs"] });
    qc.invalidateQueries({ queryKey: ["gen-logs-all"] });
    toast.success(`Cleared ${staleLogs.length} stale jobs`);
  };

  const handleStopAll = async () => {
    const active = allLogs.filter(l => ["running", "stale"].includes(getJobStatus(l)));
    if (!active.length) { toast.info("No active jobs to stop"); return; }
    if (!confirm(`Stop ALL ${active.length} running/stale jobs? This cannot be undone.`)) return;
    await Promise.all(active.map(l =>
      base44.entities.GeneratedLocationLog.update(l.id, { generation_status: "failed", error_message: "Stopped by admin" })
    ));
    qc.invalidateQueries({ queryKey: ["job-manager-logs"] });
    qc.invalidateQueries({ queryKey: ["gen-logs-all"] });
    toast.success(`Stopped ${active.length} jobs`);
  };

  // Group by batch_id
  const batchMap = {};
  for (const log of allLogs) {
    const key = log.batch_id || `single-${log.id}`;
    if (!batchMap[key]) batchMap[key] = [];
    batchMap[key].push(log);
  }

  const batches = Object.entries(batchMap).sort(([, a], [, b]) =>
    new Date(b[0]?.created_date || 0) - new Date(a[0]?.created_date || 0)
  );

  const staleCount   = allLogs.filter(l => getJobStatus(l) === "stale").length;
  const runningCount = allLogs.filter(l => getJobStatus(l) === "running").length;
  const failedCount  = allLogs.filter(l => getJobStatus(l) === "failed").length;

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold">Generation Job Manager</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {runningCount > 0 && <span className="text-blue-600">{runningCount} running · </span>}
            {staleCount > 0 && <span className="text-amber-600">{staleCount} stale · </span>}
            {failedCount > 0 && <span className="text-red-600">{failedCount} failed · </span>}
            {batches.length} batches total
          </p>
        </div>
        <div className="flex gap-2">
          {staleCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearStale} className="text-amber-700 border-amber-200 hover:bg-amber-50">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear {staleCount} Stale
            </Button>
          )}
          {(runningCount + staleCount) > 0 && (
            <Button variant="outline" size="sm" onClick={handleStopAll} className="text-red-700 border-red-200 hover:bg-red-50">
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Stop All ({runningCount + staleCount})
            </Button>
          )}
        </div>
      </div>

      {/* Stale warning banner */}
      {staleCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{staleCount} job{staleCount !== 1 ? "s" : ""}</strong> appear stuck (no update in 5+ min). Cancel or retry them to unblock the queue.</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading jobs…</div>
      ) : batches.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No generation jobs found.</div>
      ) : (
        <div className="space-y-2">
          {batches.map(([batchId, logs]) => (
            <BatchJobGroup
              key={batchId}
              batchId={batchId}
              logs={logs}
              onCancel={handleCancel}
              onRetry={handleRetry}
              cancelling={cancelling}
              retrying={retrying}
            />
          ))}
        </div>
      )}
    </div>
  );
}